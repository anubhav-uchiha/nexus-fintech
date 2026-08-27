import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { CacheService } from 'libs/cache/src';
import {
  RATE_LIMIT_PROFILE_KEY,
  RATE_LIMIT_PROFILES,
  RateLimitProfileName,
  SKIP_RATE_LIMIT_KEY,
} from './rate-limit.constants';

interface AppliedRateLimit {
  profile: RateLimitProfileName;
  maxRequests: number;
  currentRequests: number;
  remainingSeconds: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    if (this.configService.get<string>('API_RATE_LIMIT_ENABLED') === 'false') {
      return true;
    }
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const response = context.switchToHttp().getResponse<Response>();

    if (request.method === 'OPTIONS') {
      return true;
    }

    const customProfile =
      this.reflector.getAllAndOverride<RateLimitProfileName>(
        RATE_LIMIT_PROFILE_KEY,
        [context.getHandler(), context.getClass()],
      );

    const profiles: RateLimitProfileName[] = [
      'DEFAULT',
      ...(customProfile && customProfile !== 'DEFAULT' ? [customProfile] : []),
    ];

    let appliedLimits: AppliedRateLimit[];

    try {
      appliedLimits = await Promise.all(
        profiles.map((profile) => this.applyRateLimit(profile, request)),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown rate-limit error';
      this.logger.error(`Unable to enforce API rate limit: ${message}`);
      if (
        this.configService.get<string>('API_RATE_LIMIT_FAIL_OPEN') === 'true'
      ) {
        return true;
      }
      throw new ServiceUnavailableException(
        'Request processing is temporarily unavailable',
      );
    }

    const exceededLimit = appliedLimits.find(
      (limit) => limit.currentRequests > limit.maxRequests,
    );

    const selectedLimit =
      exceededLimit ?? appliedLimits[appliedLimits.length - 1];

    this.setHeaders(response, selectedLimit);

    if (exceededLimit) {
      response.setHeader(
        'Retry-After',
        exceededLimit.remainingSeconds.toString(),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Please try again in ${exceededLimit.remainingSeconds} seconds.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private async applyRateLimit(
    profileName: RateLimitProfileName,
    request: Request,
  ): Promise<AppliedRateLimit> {
    const profile = RATE_LIMIT_PROFILES[profileName];
    const maxRequests = this.getPositiveInteger(
      profile.maxRequestsEnv,
      profile.maxRequests,
    );
    const windowSeconds = this.getPositiveInteger(
      profile.windowSecondsEnv,
      profile.windowSeconds,
    );
    const ipAddress =
      request.ip?.trim() || request.socket.remoteAddress?.trim() || 'unknown';
    const ipHash = createHash('sha256').update(ipAddress).digest('hex');
    const key = `gateway:rate-limit:${profileName.toLowerCase()}:${ipHash}`;
    const currentRequests = await this.cacheService.incrementWithExpiry(
      key,
      windowSeconds,
    );

    const remainingTtl = await this.cacheService.ttl(key);
    return {
      profile: profileName,
      maxRequests,
      currentRequests,
      remainingSeconds: remainingTtl > 0 ? remainingTtl : windowSeconds,
    };
  }

  private setHeaders(response: Response, limit: AppliedRateLimit): void {
    response.setHeader('X-RateLimit-Limit', limit.maxRequests.toString());

    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, limit.maxRequests - limit.currentRequests).toString(),
    );
    response.setHeader(
      'X-RateLimit-Reset',
      (Math.floor(Date.now() / 1000) + limit.remainingSeconds).toString(),
    );
  }

  private getPositiveInteger(key: string, fallback: number): number {
    const configuredValue = Number(
      this.configService.get<string | number>(key) ?? fallback,
    );

    if (!Number.isInteger(configuredValue) || configuredValue <= 0) {
      return fallback;
    }
    return configuredValue;
  }
}
