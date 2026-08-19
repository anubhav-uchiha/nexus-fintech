import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { AuthGatewayService } from '../auth.gateway.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorator/require-permissions.decorator';

interface AuthenticatedRequest extends Request {
  user?: {
    sub?: string;
  };
}

interface IdentityPermissionResolution {
  permissionCodes?: string[];
}

interface RpcErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authGatewayService: AuthGatewayService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const identityId = request.user?.sub;

    if (!identityId) {
      throw new UnauthorizedException('Authenticated identity is missing');
    }

    let resolution: IdentityPermissionResolution;

    try {
      resolution = (await this.authGatewayService.resolveIdentityPermissions(
        identityId,
      )) as IdentityPermissionResolution;
    } catch (error) {
      this.rethrowRpcError(error);
    }

    const grantedPermissions = new Set(resolution!.permissionCodes ?? []);

    const missingPermissions = requiredPermissions.filter(
      (permission) => !grantedPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Missing required permission: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }

  private rethrowRpcError(error: unknown): never {
    const payload = this.extractRpcError(error);

    if (payload) {
      throw new HttpException(
        {
          statusCode: payload.statusCode,
          message: payload.message,
          ...(payload.error && {
            error: payload.error,
          }),
        },
        payload.statusCode,
      );
    }

    throw error;
  }

  private extractRpcError(error: unknown): RpcErrorPayload | null {
    if (typeof error !== 'object' || error === null) {
      return null;
    }

    const record = error as Record<string, unknown>;

    if (
      typeof record.statusCode === 'number' &&
      (typeof record.message === 'string' || Array.isArray(record.message))
    ) {
      return {
        statusCode: record.statusCode,
        message: record.message as string | string[],
        error: typeof record.error === 'string' ? record.error : undefined,
      };
    }

    if (record.response) {
      const responseError = this.extractRpcError(record.response);

      if (responseError) {
        return responseError;
      }
    }

    if (record.error && typeof record.error === 'object') {
      return this.extractRpcError(record.error);
    }

    return null;
  }
}
