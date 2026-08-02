import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    identityId: string;
    refreshToken: string;
    device?: string;
    ipAddress?: string;
    userAgent?: string;
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

  revokeAll(identityId: string) {
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

  updateRefreshToken(sessionId: string, refreshToken: string, expiresAt: Date) {
    return this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        refreshToken,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  getUserSessions(identityId: string) {
    return this.prisma.session.findMany({
      where: {
        identityId,
        revoked: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
