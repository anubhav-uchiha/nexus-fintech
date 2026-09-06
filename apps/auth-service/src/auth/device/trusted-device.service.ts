import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TrustedDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getTrustTtlDays(): number {
    const configured = Number(
      this.configService.get<string | number>('TRUSTED_DEVICE_TTL_DAYS') ?? 15,
    );

    return Number.isInteger(configured) && configured > 0 ? configured : 15;
  }

  private getChallengeExpiryMinutes(): number {
    const configured = Number(
      this.configService.get<string | number>(
        'LOGIN_DEVICE_CHALLENGE_EXPIRY_MINUTES',
      ) ?? 10,
    );

    return Number.isInteger(configured) && configured > 0 ? configured : 10;
  }

  async findTrustedIdentityDevice(identityId: string, deviceId: string) {
    return this.prisma.trustedDevice.findUnique({
      where: {
        identityId_deviceId: {
          identityId,
          deviceId,
        },
      },
    });
  }

  async findTrustedSuperAdminDevice(superAdminId: string, deviceId: string) {
    return this.prisma.trustedDevice.findUnique({
      where: {
        superAdminId_deviceId: {
          superAdminId,
          deviceId,
        },
      },
    });
  }

  async isIdentityDeviceTrusted(
    identityId: string,
    deviceId: string,
  ): Promise<boolean> {
    const device = await this.findTrustedIdentityDevice(identityId, deviceId);

    if (!device) {
      return false;
    }

    if (device.revokedAt) {
      return false;
    }

    if (device.trustedUntil <= new Date()) {
      return false;
    }

    await this.prisma.trustedDevice.update({
      where: {
        id: device.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return true;
  }

  async isSuperAdminDeviceTrusted(
    superAdminId: string,
    deviceId: string,
  ): Promise<boolean> {
    const device = await this.findTrustedSuperAdminDevice(
      superAdminId,
      deviceId,
    );

    if (!device) {
      return false;
    }

    if (device.revokedAt) {
      return false;
    }

    if (device.trustedUntil <= new Date()) {
      return false;
    }

    await this.prisma.trustedDevice.update({
      where: {
        id: device.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return true;
  }

  async createIdentityLoginChallenge(data: {
    identityId: string;
    deviceId: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!data.deviceId?.trim()) {
      throw new BadRequestException('Device ID is required');
    }

    const expiresAt = new Date(
      Date.now() + this.getChallengeExpiryMinutes() * 60 * 1000,
    );

    return this.prisma.loginDeviceChallenge.create({
      data: {
        identityId: data.identityId,
        deviceId: data.deviceId.trim(),
        deviceName: data.deviceName?.trim() || null,
        ipAddress: data.ipAddress?.trim() || null,
        userAgent: data.userAgent?.trim() || null,
        expiresAt,
      },
    });
  }

  async createSuperAdminLoginChallenge(data: {
    superAdminId: string;
    deviceId: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!data.deviceId?.trim()) {
      throw new BadRequestException('Device ID is required');
    }

    const expiresAt = new Date(
      Date.now() + this.getChallengeExpiryMinutes() * 60 * 1000,
    );

    return this.prisma.loginDeviceChallenge.create({
      data: {
        superAdminId: data.superAdminId,
        deviceId: data.deviceId.trim(),
        deviceName: data.deviceName?.trim() || null,
        ipAddress: data.ipAddress?.trim() || null,
        userAgent: data.userAgent?.trim() || null,
        expiresAt,
      },
    });
  }

  async findValidChallenge(challengeId: string) {
    const challenge = await this.prisma.loginDeviceChallenge.findUnique({
      where: {
        id: challengeId,
      },
    });

    if (!challenge) {
      throw new UnauthorizedException(
        'Device verification challenge not found',
      );
    }

    if (challenge.verifiedAt) {
      throw new UnauthorizedException(
        'Device verification challenge has already been used',
      );
    }

    if (challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Device verification challenge has expired',
      );
    }

    return challenge;
  }

  async incrementChallengeAttempts(challengeId: string) {
    return this.prisma.loginDeviceChallenge.update({
      where: {
        id: challengeId,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }

  async markChallengeVerified(challengeId: string) {
    return this.prisma.loginDeviceChallenge.update({
      where: {
        id: challengeId,
      },
      data: {
        verifiedAt: new Date(),
      },
    });
  }

  async trustIdentityDevice(data: {
    identityId: string;
    deviceId: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const now = new Date();

    const trustedUntil = new Date(
      now.getTime() + this.getTrustTtlDays() * 24 * 60 * 60 * 1000,
    );

    return this.prisma.trustedDevice.upsert({
      where: {
        identityId_deviceId: {
          identityId: data.identityId,
          deviceId: data.deviceId,
        },
      },
      update: {
        deviceName: data.deviceName?.trim() || null,
        userAgent: data.userAgent?.trim() || null,
        lastIpAddress: data.ipAddress?.trim() || null,
        verifiedAt: now,
        trustedUntil,
        lastUsedAt: now,
        revokedAt: null,
      },
      create: {
        identityId: data.identityId,
        deviceId: data.deviceId,
        deviceName: data.deviceName?.trim() || null,
        userAgent: data.userAgent?.trim() || null,
        lastIpAddress: data.ipAddress?.trim() || null,
        verifiedAt: now,
        trustedUntil,
        lastUsedAt: now,
      },
    });
  }

  async trustSuperAdminDevice(data: {
    superAdminId: string;
    deviceId: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const now = new Date();

    const trustedUntil = new Date(
      now.getTime() + this.getTrustTtlDays() * 24 * 60 * 60 * 1000,
    );

    return this.prisma.trustedDevice.upsert({
      where: {
        superAdminId_deviceId: {
          superAdminId: data.superAdminId,
          deviceId: data.deviceId,
        },
      },
      update: {
        deviceName: data.deviceName?.trim() || null,
        userAgent: data.userAgent?.trim() || null,
        lastIpAddress: data.ipAddress?.trim() || null,
        verifiedAt: now,
        trustedUntil,
        lastUsedAt: now,
        revokedAt: null,
      },
      create: {
        superAdminId: data.superAdminId,
        deviceId: data.deviceId,
        deviceName: data.deviceName?.trim() || null,
        userAgent: data.userAgent?.trim() || null,
        lastIpAddress: data.ipAddress?.trim() || null,
        verifiedAt: now,
        trustedUntil,
        lastUsedAt: now,
      },
    });
  }
}
