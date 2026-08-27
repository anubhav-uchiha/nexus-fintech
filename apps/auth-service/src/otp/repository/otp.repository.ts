import { OtpPurpose, OtpType, Prisma } from '../../../generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OtpCreateInput) {
    return this.prisma.otp.create({ data });
  }

  async findLatest(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ) {
    return this.prisma.otp.findFirst({
      where: {
        type,
        purpose,
        phoneNumber,
        email,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByPhoneNumber(phoneNumber: string) {
    return this.prisma.identity.findUnique({ where: { phoneNumber } });
  }

  async findByEmail(email: string) {
    return this.prisma.identity.findUnique({ where: { email } });
  }

  async deleteUnverified(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ) {
    return this.prisma.otp.deleteMany({
      where: { type, purpose, phoneNumber, email, verifiedAt: null },
    });
  }
  async markVerified(id: string) {
    return this.prisma.otp.update({
      where: { id },
      data: { verifiedAt: new Date() },
    });
  }

  async markVerifiedIfPending(id: string) {
    return this.prisma.otp.updateMany({
      where: {
        id,
        verifiedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        verifiedAt: new Date(),
      },
    });
  }

  async increaseAttempts(id: string) {
    return this.prisma.otp.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async increaseAttemptsIfPending(id: string) {
    return this.prisma.otp.updateMany({
      where: {
        id,
        verifiedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }

  async findVerified(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ) {
    return this.prisma.otp.findFirst({
      where: {
        type,
        purpose,
        phoneNumber,
        email,
        verifiedAt: { not: null },
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  async deleteById(id: string) {
    return this.prisma.otp.deleteMany({
      where: {
        id,
      },
    });
  }
}
