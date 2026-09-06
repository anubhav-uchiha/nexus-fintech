import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AccountOnboardingStatus,
  LoginMethod,
  Prisma,
  UserStatus,
} from 'apps/auth-service/generated/prisma/client';

export interface CreateManagedSuperAdminData {
  creatorSuperAdminId: string;

  fullName: string;
  username: string;
  email: string;

  city: string;
  state: string;
  pincode: string;

  shopName?: string;
  shopAddress?: string;
  shopCity?: string;
  shopState?: string;

  hashedPassword: string;
  hashedMpin: string;
  temporaryCredentialsExpireAt: Date;
}

@Injectable()
export class SuperAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdentifier(identifier: string) {
    const normalizedIdentifier = identifier.trim();

    return this.prisma.superAdmin.findFirst({
      where: {
        OR: [
          {
            loginId: {
              equals: normalizedIdentifier,
              mode: 'insensitive',
            },
          },
          {
            username: {
              equals: normalizedIdentifier,
              mode: 'insensitive',
            },
          },
          {
            phoneNumber: normalizedIdentifier,
          },
        ],
      },
      include: {
        role: true,
      },
    });
  }
  findById(id: string) {
    return this.prisma.superAdmin.findUnique({
      where: {
        id,
      },
      include: {
        role: true,
      },
    });
  }
  findByEmail(email: string) {
    return this.prisma.superAdmin.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: 'insensitive',
        },
      },
      include: {
        role: true,
      },
    });
  }
  findByUsername(username: string) {
    return this.prisma.superAdmin.findFirst({
      where: {
        username: {
          equals: username.trim(),
          mode: 'insensitive',
        },
      },
      include: {
        role: true,
      },
    });
  }
  findByPhoneNumber(phoneNumber: string) {
    return this.prisma.superAdmin.findUnique({
      where: {
        phoneNumber,
      },
      include: {
        role: true,
      },
    });
  }

  findByPanNumber(panNumber: string) {
    return this.prisma.superAdmin.findUnique({
      where: {
        panNumber,
      },
      include: {
        role: true,
      },
    });
  }

  update(id: string, data: Prisma.SuperAdminUpdateInput) {
    return this.prisma.superAdmin.update({
      where: {
        id,
      },
      data,
      include: {
        role: true,
      },
    });
  }

  updateLastLogin(
    id: string,
    location?: {
      latitude: number;
      longitude: number;
    },
  ) {
    return this.prisma.superAdmin.update({
      where: {
        id,
      },
      data: {
        lastLoginAt: new Date(),

        ...(location && {
          lastLoginLatitude: location.latitude,
          lastLoginLongitude: location.longitude,
        }),
      },
    });
  }

  async changePasswordAndRevokeOtherSessions(data: {
    superAdminId: string;
    currentSessionId: string;
    expectedPasswordHash: string;
    hashedPassword: string;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.superAdmin.updateMany({
        where: {
          id: data.superAdminId,
          password: data.expectedPasswordHash,
        },
        data: {
          password: data.hashedPassword,
          passwordChangedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        return {
          updated: false,
          revokedSessionCount: 0,
        };
      }

      const revokedSessions = await transaction.superAdminSession.updateMany({
        where: {
          superAdminId: data.superAdminId,
          id: {
            not: data.currentSessionId,
          },
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      return {
        updated: true,
        revokedSessionCount: revokedSessions.count,
      };
    });
  }

  async changeMpinAndCompleteOnboarding(data: {
    superAdminId: string;
    currentSessionId: string;
    expectedMpinHash: string;
    hashedMpin: string;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.superAdmin.updateMany({
        where: {
          id: data.superAdminId,
          mpin: data.expectedMpinHash,
        },
        data: {
          mpin: data.hashedMpin,
          mpinChangedAt: new Date(),
          onboardingStatus: AccountOnboardingStatus.COMPLETED,
          temporaryCredentialsExpireAt: null,
        },
      });

      if (updated.count !== 1) {
        return {
          updated: false,
          revokedSessionCount: 0,
        };
      }

      const revokedSessions = await transaction.superAdminSession.updateMany({
        where: {
          superAdminId: data.superAdminId,
          id: {
            not: data.currentSessionId,
          },
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      return {
        updated: true,
        revokedSessionCount: revokedSessions.count,
      };
    });
  }

  async createManagedSuperAdmin(data: CreateManagedSuperAdminData) {
    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({
        where: {
          name: 'SUPER_ADMIN',
        },
      });

      if (!role || !role.isActive) {
        throw new BadRequestException(
          'Super Admin role is unavailable or inactive',
        );
      }

      const updatedRole = await transaction.role.update({
        where: {
          id: role.id,
        },
        data: {
          lastLoginIdNumber: {
            increment: 1,
          },
        },
        select: {
          id: true,
          prefix: true,
          lastLoginIdNumber: true,
        },
      });

      const numberPart = updatedRole.lastLoginIdNumber
        .toString()
        .padStart(4, '0');

      const loginId = `${updatedRole.prefix}${numberPart}`;

      return transaction.superAdmin.create({
        data: {
          loginId,

          fullName: data.fullName.trim(),
          username: data.username.trim().toLowerCase(),
          email: data.email.trim().toLowerCase(),

          phoneNumber: null,
          aadhaarNumber: null,
          panNumber: null,

          password: data.hashedPassword,
          mpin: data.hashedMpin,

          shopName: data.shopName?.trim() || null,
          shopAddress: data.shopAddress?.trim() || null,
          shopCity: data.shopCity?.trim() || null,
          shopState: data.shopState?.trim() || null,

          city: data.city.trim(),
          state: data.state.trim(),
          pincode: data.pincode.trim(),

          status: UserStatus.ACTIVE,
          isEmailVerified: false,
          isPhoneVerified: false,
          isPanVerified: false,

          preferredLoginMethod: LoginMethod.LOGIN_ID,
          onboardingStatus: AccountOnboardingStatus.CREDENTIALS_ISSUED,

          temporaryCredentialsExpireAt: data.temporaryCredentialsExpireAt,

          isPrimary: false,

          role: {
            connect: {
              id: updatedRole.id,
            },
          },

          createdBySuperAdmin: {
            connect: {
              id: data.creatorSuperAdminId,
            },
          },
        },
        include: {
          role: true,
        },
      });
    });
  }
}
