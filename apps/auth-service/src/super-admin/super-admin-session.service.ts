import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface CreateSuperAdminSessionData {
  id: string;
  superAdminId: string;
  refreshToken: string;
  expiresAt: Date;

  ipAddress?: string;
  userAgent?: string;
  device?: string;

  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationCapturedAt?: Date;
}

@Injectable()
export class SuperAdminSessionService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateSuperAdminSessionData) {
    return this.prisma.superAdminSession.create({
      data: {
        id: data.id,
        superAdminId: data.superAdminId,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,

        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        device: data.device,

        latitude: data.latitude,
        longitude: data.longitude,
        locationAccuracy: data.locationAccuracy,
        locationCapturedAt: data.locationCapturedAt,
      },
    });
  }

  findValidSessionById(
    sessionId: string,
    superAdminId: string,
    refreshToken: string,
  ) {
    return this.prisma.superAdminSession.findFirst({
      where: {
        id: sessionId,
        superAdminId,
        refreshToken,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        superAdmin: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async validateSession(
    superAdminId: string,
    sessionId: string,
  ): Promise<{
    valid: boolean;
    onboardingStatus?: string;
    onboardingCompleted?: boolean;
  }> {
    const session = await this.prisma.superAdminSession.findFirst({
      where: {
        id: sessionId,
        superAdminId,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        superAdmin: {
          select: {
            status: true,
            onboardingStatus: true,
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
      session.superAdmin.status !== 'ACTIVE' ||
      session.superAdmin.role.name !== 'SUPER_ADMIN' ||
      !session.superAdmin.role.isActive
    ) {
      return {
        valid: false,
      };
    }

    return {
      valid: true,
      onboardingStatus: session.superAdmin.onboardingStatus,
      onboardingCompleted: session.superAdmin.onboardingStatus === 'COMPLETED',
    };
  }

  async rotateRefreshToken(
    sessionId: string,
    currentRefreshToken: string,
    nextRefreshToken: string,
  ): Promise<boolean> {
    const result = await this.prisma.superAdminSession.updateMany({
      where: {
        id: sessionId,
        refreshToken: currentRefreshToken,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        refreshToken: nextRefreshToken,
        lastUsedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async revoke(sessionId: string): Promise<boolean> {
    const result = await this.prisma.superAdminSession.updateMany({
      where: {
        id: sessionId,
        revoked: false,
      },
      data: {
        revoked: true,
        lastUsedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async revokeOtherSessions(
    superAdminId: string,
    currentSessionId: string,
  ): Promise<number> {
    const result = await this.prisma.superAdminSession.updateMany({
      where: {
        superAdminId,
        revoked: false,
        id: {
          not: currentSessionId,
        },
      },
      data: {
        revoked: true,
      },
    });

    return result.count;
  }
  async revokeAllSessions(superAdminId: string): Promise<number> {
    const result = await this.prisma.superAdminSession.updateMany({
      where: {
        superAdminId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });

    return result.count;
  }
  getActiveSessions(superAdminId: string) {
    return this.prisma.superAdminSession.findMany({
      where: {
        superAdminId,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        device: true,
        latitude: true,
        longitude: true,
        locationAccuracy: true,
        locationCapturedAt: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
