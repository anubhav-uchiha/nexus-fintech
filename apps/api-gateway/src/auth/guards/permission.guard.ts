import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { AuthGatewayService } from '../auth.gateway.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorator/require-permissions.decorator';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'libs/cache/src';
import {
  PERMISSION_CACHE_KEY_PREFIX,
  PERMISSION_CACHE_VERSION_KEY,
} from '../constants/permission-cache.constants';

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
  private readonly logger = new Logger(PermissionGuard.name);

  private readonly permissionCacheTtlSeconds: number;
  constructor(
    private readonly reflector: Reflector,
    private readonly authGatewayService: AuthGatewayService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    const configuredTtl = Number(
      this.configService.get<string | number>(
        'AUTH_PERMISSION_CACHE_TTL_SECONDS',
      ) ?? 10,
    );

    this.permissionCacheTtlSeconds =
      Number.isInteger(configuredTtl) && configuredTtl > 0 ? configuredTtl : 10;
  }

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

    const permissionCodes = await this.getIdentityPermissionCodes(identityId);

    const grantedPermissions = new Set(permissionCodes);

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

  private async getIdentityPermissionCodes(
    identityId: string,
  ): Promise<string[]> {
    const cacheVersion = await this.getPermissionCacheVersion();

    const cacheKey =
      cacheVersion !== null
        ? `${PERMISSION_CACHE_KEY_PREFIX}:v${cacheVersion}:${identityId}`
        : null;
    if (cacheKey) {
      try {
        const cachedPermissions =
          await this.cacheService.get<string[]>(cacheKey);

        if (Array.isArray(cachedPermissions)) {
          return cachedPermissions.filter(
            (permission): permission is string =>
              typeof permission === 'string',
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown Redis read error';

        this.logger.warn(`Unable to read permission cache: ${message}`);
      }
    }

    let resolution: IdentityPermissionResolution;

    try {
      resolution = (await this.authGatewayService.resolveIdentityPermissions(
        identityId,
      )) as IdentityPermissionResolution;
    } catch (error) {
      this.rethrowRpcError(error);
    }

    const permissionCodes = Array.isArray(resolution!.permissionCodes)
      ? resolution!.permissionCodes.filter(
          (permission): permission is string => typeof permission === 'string',
        )
      : [];
    if (cacheKey) {
      try {
        await this.cacheService.set(
          cacheKey,
          permissionCodes,
          this.permissionCacheTtlSeconds,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown Redis write error';

        this.logger.warn(`Unable to write permission cache: ${message}`);
      }
    }

    return permissionCodes;
  }

  private async getPermissionCacheVersion(): Promise<number | null> {
    try {
      const version = await this.cacheService.get<number>(
        PERMISSION_CACHE_VERSION_KEY,
      );
      if (version === null || !Number.isInteger(version) || version < 0) {
        return 0;
      }

      return version;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown permission cache version error';

      this.logger.warn(`Unable to read permission cache version: ${message}`);
      return null;
    }
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
