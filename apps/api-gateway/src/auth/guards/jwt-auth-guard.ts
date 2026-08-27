import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGatewayService } from './../auth.gateway.service';
import { JwtPayload } from 'apps/auth-service/src/auth/jwt/interfaces/jwt-payload.interface';
import { CacheService } from 'libs/cache/src';
import {
  getSessionValidationCacheKey,
  getSessionValidationVersionKey,
} from '@nexus/common/auth/constants/session-validation-cache.constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly validationCacheTtlSeconds: number;
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly authGatewayService: AuthGatewayService,
    private readonly cacheService: CacheService,
  ) {
    const configuredTtl = Number(
      this.config.get<string | number>(
        'AUTH_SESSION_VALIDATION_CACHE_TTL_SECONDS',
      ) ?? 5,
    );

    this.validationCacheTtlSeconds =
      Number.isInteger(configuredTtl) && configuredTtl > 0 ? configuredTtl : 5;
  }

  private async getSessionValidationVersion(
    identityId: string,
  ): Promise<number | null> {
    try {
      const storedVersion = await this.cacheService.get<number | string>(
        getSessionValidationVersionKey(identityId),
      );

      if (storedVersion === null || storedVersion === undefined) {
        return 0;
      }

      const parsedVersion = Number(storedVersion);

      if (!Number.isSafeInteger(parsedVersion) || parsedVersion < 0) {
        this.logger.warn(
          'Invalid session-validation cache version; bypassing cache',
        );

        return null;
      }

      return parsedVersion;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Redis version read error';

      this.logger.warn(
        `Unable to read session-validation cache version: ${message}`,
      );
      return null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Access token missing');
    }
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header');
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new UnauthorizedException(
        'Access token does not contain a valid session',
      );
    }

    const cacheVersion = await this.getSessionValidationVersion(payload.sub);

    const cacheKey =
      cacheVersion === null
        ? null
        : getSessionValidationCacheKey(payload.sub, payload.sid, cacheVersion);

    let cachedValidation: boolean | null = null;
    if (cacheKey) {
      try {
        cachedValidation = await this.cacheService.get<boolean>(cacheKey);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown Redis read error';

        this.logger.warn(
          `Unable to read cached session validation: ${message}`,
        );
      }
    }

    if (cachedValidation === false) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    if (cachedValidation === true) {
      request.user = payload;
      return true;
    }

    let session: {
      valid: boolean;
    };

    try {
      session = await this.authGatewayService.validateSession(
        payload.sub,
        payload.sid,
      );
    } catch {
      throw new ServiceUnavailableException(
        'Session validation service is currently unavailable',
      );
    }
    if (cacheKey) {
      try {
        await this.cacheService.set(
          cacheKey,
          session.valid,
          this.validationCacheTtlSeconds,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown Redis write error';

        this.logger.warn(`Unable to cache session validation: ${message}`);
      }
    }

    if (!session.valid) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    request.user = payload;

    return true;
  }
}
