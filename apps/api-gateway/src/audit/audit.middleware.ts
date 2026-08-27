import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { JwtPayload } from 'apps/auth-service/src/auth/jwt/interfaces/jwt-payload.interface';
import { AuditPublisherService } from './audit-publisher.service';
import { NextFunction, Request, Response } from 'express';

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);
  constructor(private readonly auditPublisherService: AuditPublisherService) {}

  use(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    response.once('finish', () => {
      void this.publishRequestAudit(request, response);
    });
    next();
  }

  private async publishRequestAudit(
    request: AuthenticatedRequest,
    response: Response,
  ): Promise<void> {
    try {
      const method = request.method.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return;
      }

      const endpoint = request.originalUrl.split('?')[0];
      const routePath =
        typeof request.route?.path === 'string' ? request.route.path : endpoint;
      const user = request.user;
      const ipAddress = (request.ip ?? request.socket.remoteAddress)?.replace(
        /^::ffff:/,
        '',
      );

      await this.auditPublisherService.publish({
        identityId: user?.sub,
        sessionId: user?.sid,
        loginId: user?.loginId,
        role: user?.role,
        service: this.resolveService(endpoint),
        action: this.resolveAction(method, routePath),
        status: response.statusCode >= 400 ? 'FAILED' : 'SUCCESS',
        httpMethod: method,
        endpoint,
        statusCode: response.statusCode,
        ipAddress,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknow audit error';

      this.logger.error(`Failed to publish audit event: ${message}`);
    }
  }

  private resolveService(endpoint: string): string {
    const firstSegment = endpoint.split('/').filter(Boolean)[0]?.toLowerCase();

    if (!firstSegment) {
      return 'API_GATEWAY';
    }

    if (
      [
        'auth',
        'role',
        'roles',
        'permission',
        'permissions',
        'package',
        'packages',
      ].includes(firstSegment)
    ) {
      return 'AUTH';
    }
    if (firstSegment === 'kyc') {
      return 'KYC';
    }

    if (['wallet', 'wallets'].includes(firstSegment)) {
      return 'WALLET';
    }

    if (['transaction', 'transactions'].includes(firstSegment)) {
      return 'TRANSACTION';
    }

    if (['aeps', 'eko', 'vimopay'].includes(firstSegment)) {
      return 'AEPS';
    }

    if (firstSegment.startsWith('commission')) {
      return 'COMMISSION';
    }

    if (firstSegment === 'audit') {
      return 'AUDIT';
    }

    return 'API_GATEWAY';
  }

  private resolveAction(method: string, routePath: string): string {
    const normalizedPath = routePath
      .replace(/:[a-zA-Z0-9_]+/g, 'ID')
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[099a-f]{4}-[0-9a-f]{12}/gi,
        'ID',
      )
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();

    return `${method}_${normalizedPath}`.slice(0, 100);
  }
}
