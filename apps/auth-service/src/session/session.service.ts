import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { KafkaProducerService } from 'libs/kafka/src';
import { AUDIT_PATTERNS, CreateAuditLogDto } from '@nexus/common/audit';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'apps/auth-service/generated/prisma/client';
import { CacheService } from 'libs/cache/src';
import { getSessionValidationVersionKey } from '@nexus/common/auth/constants/session-validation-cache.constants';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshTokenHashPrefix = 'hmac-sha256:';

  private readonly refreshTokenHashSecret: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    const secret = this.configService.get<string>(
      'SESSION_REFRESH_TOKEN_HASH_SECRET',
    );

    if (!secret || secret.length < 32) {
      throw new Error(
        'SESSION_REFRESH_TOKEN_HASH_SECRET must contain at least 32 characters',
      );
    }

    this.refreshTokenHashSecret = secret;
  }

  private refreshTokenMatches(
    storedToken: string,
    presentedToken: string,
  ): boolean {
    const expectedToken = storedToken.startsWith(this.refreshTokenHashPrefix)
      ? this.hashRefreshToken(presentedToken)
      : presentedToken;

    const storedBuffer = Buffer.from(storedToken, 'utf8');
    const expectedBuffer = Buffer.from(expectedToken, 'utf8');

    if (storedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, expectedBuffer);
  }

  private hashRefreshToken(refreshToken: string): string {
    const hash = createHmac('sha256', this.refreshTokenHashSecret)
      .update(refreshToken)
      .digest('hex');

    return `${this.refreshTokenHashPrefix}${hash}`;
  }

  private getRefreshTokenConditions(
    refreshToken: string,
  ): Prisma.SessionWhereInput {
    return {
      OR: [
        {
          refreshToken: this.hashRefreshToken(refreshToken),
        },
        {
          refreshToken,
          NOT: {
            refreshToken: {
              startsWith: this.refreshTokenHashPrefix,
            },
          },
        },
      ],
    };
  }

  private readonly sessionSelect = {
    id: true,
    identityId: true,
    device: true,
    ipAddress: true,
    userAgent: true,
    latitude: true,
    longitude: true,
    locationAccuracy: true,
    locationCapturedAt: true,
    revoked: true,
    lastUsedAt: true,
    expiresAt: true,
    createdAt: true,
  } as const;

  create(data: {
    id?: string;
    identityId: string;
    refreshToken: string;
    device?: string;
    ipAddress?: string;
    userAgent?: string;

    latitude?: number;
    longitude?: number;
    locationAccuracy?: number;
    locationCapturedAt?: Date;

    expiresAt: Date;
  }) {
    const { refreshToken, ...sessionData } = data;
    return this.prisma.session.create({
      data: {
        ...sessionData,
        refreshToken: this.hashRefreshToken(refreshToken),
      },
    });
  }

  async revoke(sessionId: string) {
    const session = await this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        revoked: true,
      },
    });

    await this.advanceSessionValidationCacheVersion(session.identityId);
    return session;
  }

  async revokeAll(identityId: string) {
    const result = await this.prisma.session.updateMany({
      where: {
        identityId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });

    if (result.count > 0) {
      await this.advanceSessionValidationCacheVersion(identityId);
    }
    return result;
  }

  updateRefreshToken(sessionId: string, refreshToken: string) {
    return this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        refreshToken: this.hashRefreshToken(refreshToken),
        lastUsedAt: new Date(),
      },
    });
  }

  async rotateRefreshToken(
    sessionId: string,
    currentRefreshToken: string,
    newRefreshToken: string,
  ): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
        ...this.getRefreshTokenConditions(currentRefreshToken),
      },
      data: {
        refreshToken: this.hashRefreshToken(newRefreshToken),
        lastUsedAt: new Date(),
      },
    });
    return result.count === 1;
  }

  async getUserSessions(identityId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        identityId,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: this.sessionSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));
  }

  async getUserSessionById(
    identityId: string,
    sessionId: string,
    currentSessionId: string,
  ) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        identityId,
      },
      select: this.sessionSelect,
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return {
      ...session,
      isCurrent: session.id === currentSessionId,
    };
  }

  async revokeUserSession(
    identityId: string,
    sessionId: string,
    currentSessionId: string,
  ) {
    try {
      const session = await this.prisma.session.findFirst({
        where: {
          id: sessionId,
          identityId,
        },
        select: {
          id: true,
          revoked: true,
          expiresAt: true,
        },
      });
      if (!session) {
        throw new NotFoundException('Session not found');
      }
      if (session.revoked) {
        throw new ConflictException('Session has already been revoked');
      }
      if (session.expiresAt <= new Date()) {
        throw new BadRequestException('Session has already expired');
      }
      const result = await this.prisma.session.updateMany({
        where: {
          id: sessionId,
          identityId,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          revoked: true,
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Session could not be revoked because its status changed',
        );
      }

      await this.advanceSessionValidationCacheVersion(identityId);

      const isCurrent = session.id === currentSessionId;

      await this.publishSessionAuditLog({
        identityId,
        sessionId: currentSessionId,
        action: 'SESSION_REVOKED',
        status: 'SUCCESS',
        httpMethod: 'DELETE',
        endpoint: `/auth/sessions/${sessionId}`,
        statusCode: 200,
        metadata: {
          revokedSessionId: sessionId,
          isCurrent,
        },
      });
      return {
        success: true,
        message: 'Session revoked successfully',
        sessionId,
        isCurrent: session.id === currentSessionId,
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof Error
          ? error.message
          : 'Unexpected session revocation error';

      await this.publishSessionAuditLog({
        identityId,
        sessionId: currentSessionId,
        action: 'SESSION_REVOKE_FAILED',
        status: 'FAILED',
        httpMethod: 'DELETE',
        endpoint: `/auth/sessions/${sessionId}`,
        statusCode,

        metadata: {
          requestedSessionId: sessionId,
          reason,
        },
      });

      throw error;
    }
  }

  async revokeOtherSessions(identityId: string, currentSessionId: string) {
    try {
      const currentSession = await this.prisma.session.findFirst({
        where: {
          id: currentSessionId,
          identityId,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

      if (!currentSession) {
        throw new UnauthorizedException(
          'Current session not found or has expired',
        );
      }

      const result = await this.prisma.session.updateMany({
        where: {
          identityId,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
          id: {
            not: currentSession.id,
          },
        },
        data: {
          revoked: true,
        },
      });
      if (result.count > 0) {
        await this.advanceSessionValidationCacheVersion(identityId);
      }

      await this.publishSessionAuditLog({
        identityId,
        sessionId: currentSession.id,
        action: 'OTHER_SESSIONS_REVOKED',
        status: 'SUCCESS',
        httpMethod: 'DELETE',
        endpoint: '/auth/sessions/others',
        statusCode: 200,
        metadata: {
          revokedCount: result.count,
          currentSessionId: currentSession.id,
        },
      });

      return {
        success: true,
        message: 'Other sessions revoked successfully',
        revokedCount: result.count,
        currentSessionId: currentSession.id,
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;
      const reason =
        error instanceof Error
          ? error.message
          : 'Unexpected session revocation error';
      await this.publishSessionAuditLog({
        identityId,
        sessionId: currentSessionId,
        action: 'OTHER_SESSIONS_REVOKE_FAILED',
        status: 'FAILED',
        httpMethod: 'DELETE',
        endpoint: '/auth/sessions/others',
        statusCode,
        metadata: {
          reason,
        },
      });
      throw error;
    }
  }

  async revokeAllUserSessions(identityId: string, currentSessionId: string) {
    try {
      const currentSession = await this.prisma.session.findFirst({
        where: {
          id: currentSessionId,
          identityId,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

      if (!currentSession) {
        throw new UnauthorizedException(
          'Current session not found or has expired',
        );
      }

      const result = await this.prisma.session.updateMany({
        where: {
          identityId,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          revoked: true,
        },
      });

      if (result.count > 0) {
        await this.advanceSessionValidationCacheVersion(identityId);
      }

      await this.publishSessionAuditLog({
        identityId,
        sessionId: currentSession.id,
        action: 'ALL_SESSIONS_REVOKED',
        status: 'SUCCESS',
        httpMethod: 'DELETE',
        endpoint: '/auth/sessions',
        statusCode: 200,
        metadata: {
          revokedCount: result.count,
          currentSessionId: currentSession.id,
        },
      });
      return {
        success: true,
        message: 'All sessions revoked successfully',
        revokedCount: result.count,
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof Error
          ? error.message
          : 'Unexpected session revocation error';

      await this.publishSessionAuditLog({
        identityId,

        sessionId: currentSessionId,

        action: 'ALL_SESSIONS_REVOKE_FAILED',

        status: 'FAILED',

        httpMethod: 'DELETE',

        endpoint: '/auth/sessions',

        statusCode,

        metadata: {
          reason,
        },
      });

      throw error;
    }
  }

  async validateSession(identityId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        identityId,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
      },
    });
    return {
      valid: !!session,
    };
  }

  async findValidSessionById(
    sessionId: string,
    identityId: string,
    refreshToken: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        id: true,
        identityId: true,
        refreshToken: true,
        revoked: true,
        expiresAt: true,
        identity: {
          select: {
            id: true,
            loginId: true,
            fullName: true,
            username: true,
            email: true,
            phoneNumber: true,
            status: true,
            preferredLoginMethod: true,
            role: {
              select: {
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.identityId !== identityId ||
      session.revoked ||
      session.expiresAt <= new Date() ||
      !this.refreshTokenMatches(session.refreshToken, refreshToken)
    ) {
      return null;
    }

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      identity: session.identity,
    };
  }

  private async publishSessionAuditLog(
    data: Omit<
      CreateAuditLogDto,
      'eventId' | 'service' | 'loginId' | 'role'
    > & {
      identityId: string;
    },
  ): Promise<void> {
    try {
      const identity = await this.prisma.identity.findUnique({
        where: {
          id: data.identityId,
        },

        select: {
          loginId: true,

          role: {
            select: {
              name: true,
            },
          },
        },
      });

      await this.kafkaProducer.publish(AUDIT_PATTERNS.CREATE_LOG, {
        eventId: randomUUID(),

        ...data,

        loginId: identity?.loginId,

        role: identity?.role.name,

        service: 'AUTH',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown session audit publishing error';

      this.logger.error(`Failed to publish session audit log: ${message}`);
    }
  }
  private async advanceSessionValidationCacheVersion(
    identityId: string,
  ): Promise<void> {
    try {
      const version = await this.cacheService.increment(
        getSessionValidationVersionKey(identityId),
      );

      this.logger.log(
        `Session-validation cache version advanced to ${version}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown session cache invalidation error';

      this.logger.error(
        `Unable to invalidate session-validation cache: ${message}`,
      );
    }
  }
}
