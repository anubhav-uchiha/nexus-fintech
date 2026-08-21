import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.session.create({
      data,
    });
  }

  findByRefreshToken(refreshToken: string) {
    return this.prisma.session.findFirst({
      where: {
        refreshToken,
        revoked: false,
      },
      include: {
        identity: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  revoke(sessionId: string) {
    return this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        revoked: true,
      },
    });
  }

  async revokeAll(identityId: string) {
    return this.prisma.session.updateMany({
      where: {
        identityId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });
  }

  updateRefreshToken(sessionId: string, refreshToken: string) {
    return this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        refreshToken,
        lastUsedAt: new Date(),
      },
    });
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
    return {
      success: true,
      message: 'Session revoked successfully',
      sessionId,
      isCurrent: session.id === currentSessionId,
    };
  }

  async revokeOtherSessions(identityId: string, currentSessionId: string) {
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

    return {
      success: true,
      message: 'Other sessions revoked successfully',
      revokedCount: result.count,
      currentSessionId: currentSession.id,
    };
  }

  async revokeAllUserSessions(identityId: string) {
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
    return {
      success: true,
      message: 'All sessions revoked successfully',
      revokedCount: result.count,
    };
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

  findValidSession(refreshToken: string) {
    return this.prisma.session.findFirst({
      where: {
        refreshToken,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        identity: {
          include: {
            role: true,
          },
        },
      },
    });
  }
}
