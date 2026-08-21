import {
  LoginMethod,
  Prisma,
  RegistrationStep,
} from '../../generated/prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from 'libs/cache/src';
import { CompleteRegistrationData } from '../auth/types/register.type';

export type DuplicateField = 'email' | 'username' | 'phoneNumber' | null;

export type IdentityWithRole = Prisma.IdentityGetPayload<{
  include: {
    role: true;
  };
}>;

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async findByEmail(email: string): Promise<IdentityWithRole | null> {
    const key = `identity:email:${email}`;

    const cached = await this.cacheService.get<IdentityWithRole>(key);

    if (cached) {
      return cached;
    }
    const identity = await this.prisma.identity.findUnique({
      where: { email },
      include: { role: true },
    });

    if (identity) {
      await this.cacheService.set(key, identity, 300);
    }
    return identity;
  }

  async findByUsername(username: string): Promise<IdentityWithRole | null> {
    const key = `identity:username:${username}`;

    const cached = await this.cacheService.get<IdentityWithRole>(key);

    if (cached) {
      return cached;
    }

    const identity = await this.prisma.identity.findUnique({
      where: { username },
      include: {
        role: true,
      },
    });

    if (identity) {
      await this.cacheService.set(key, identity, 300);
    }

    return identity;
  }

  async findByPhoneNumber(
    phoneNumber: string,
  ): Promise<IdentityWithRole | null> {
    const key = `identity:phone:${phoneNumber}`;
    const cached = await this.cacheService.get<IdentityWithRole>(key);
    if (cached) {
      return cached;
    }
    const identity = await this.prisma.identity.findUnique({
      where: { phoneNumber },
      include: { role: true },
    });

    if (identity) {
      await this.cacheService.set(key, identity, 300);
    }

    return identity;
  }

  async findByLoginId(loginId: string): Promise<IdentityWithRole | null> {
    const key = `identity:loginId:${loginId}`;

    const cached = await this.cacheService.get<IdentityWithRole>(key);

    if (cached) {
      return cached;
    }

    const identity = await this.prisma.identity.findUnique({
      where: {
        loginId,
      },
      include: {
        role: true,
      },
    });

    if (identity) {
      await this.cacheService.set(key, identity, 300);
    }

    return identity;
  }

  async findById(id: string) {
    return this.prisma.identity.findUnique({
      where: {
        id,
      },
    });
  }

  async findByIdentifier(identifier: string) {
    let identity = await this.findByEmail(identifier);

    if (identity?.preferredLoginMethod === LoginMethod.EMAIL) {
      return identity;
    }

    identity = await this.findByUsername(identifier);

    if (identity?.preferredLoginMethod === LoginMethod.USERNAME) {
      return identity;
    }

    identity = await this.findByLoginId(identifier);

    if (identity?.preferredLoginMethod === LoginMethod.LOGIN_ID) {
      return identity;
    }

    identity = await this.findByPhoneNumber(identifier);

    if (identity?.preferredLoginMethod === LoginMethod.PHONENUMBER) {
      return identity;
    }

    return null;
  }

  async findByPanNumber(panNumber: string) {
    return this.prisma.identity.findUnique({
      where: {
        panNumber,
      },
    });
  }

  async findByAadhaarNumber(aadhaarNumber: string) {
    return this.prisma.identity.findUnique({
      where: {
        aadhaarNumber,
      },
    });
  }

  async checkDuplicate(
    data: Pick<
      Prisma.IdentityCreateInput,
      'email' | 'username' | 'phoneNumber'
    >,
  ): Promise<DuplicateField> {
    const identity = await this.prisma.identity.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
          { phoneNumber: data.phoneNumber },
        ],
      },
    });

    if (!identity) {
      return null;
    }

    if (identity.email === data.email) {
      return 'email';
    }

    if (identity.username === data.username) {
      return 'username';
    }

    return 'phoneNumber';
  }

  async findRoleByName(name: string) {
    const key = `role:${name}`;

    const cached = await this.cacheService.get(key);

    if (cached) {
      return cached;
    }

    const role = await this.prisma.role.findUnique({
      where: {
        name,
      },
    });

    if (role) {
      await this.cacheService.set(key, role, 3600);
    }

    return role;
  }

  async updateLastLogin(
    identityId: string,
    location?: {
      latitude: number;
      longitude: number;
    },
  ) {
    const identity = await this.prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        lastLoginAt: new Date(),

        lastLoginLatitude: location?.latitude ?? null,

        lastLoginLongitude: location?.longitude ?? null,
      },
    });
    await this.clearIdentityCache(identity);
    return identity;
  }

  async clearIdentityCache(identity: {
    email?: string | null;
    username?: string | null;
    loginId?: string | null;
    phoneNumber?: string | null;
  }) {
    if (identity.email) {
      await this.cacheService.del(`identity:email:${identity.email}`);
    }

    if (identity.username) {
      await this.cacheService.del(`identity:username:${identity.username}`);
    }

    if (identity.loginId) {
      await this.cacheService.del(`identity:loginId:${identity.loginId}`);
    }

    if (identity.phoneNumber) {
      await this.cacheService.del(`identity:phone:${identity.phoneNumber}`);
    }
  }

  async createRegistrationDraft(data: Prisma.RegistrationDraftCreateInput) {
    return this.prisma.registrationDraft.create({
      data,
      include: {
        role: true,
      },
    });
  }

  async findRegistrationDraft(id: string) {
    return this.prisma.registrationDraft.findUnique({
      where: {
        id,
      },
      include: {
        role: true,
      },
    });
  }

  async findRegistrationDraftByPhone(phoneNumber: string) {
    return this.prisma.registrationDraft.findUnique({
      where: {
        phoneNumber,
      },
      include: {
        role: true,
      },
    });
  }

  async findRegistrationDraftByEmail(email: string) {
    return this.prisma.registrationDraft.findUnique({
      where: {
        email,
      },
    });
  }

  async findRegistrationDraftByUsername(username: string) {
    return this.prisma.registrationDraft.findUnique({
      where: {
        username,
      },
    });
  }

  async findRegistrationDraftByPan(panNumber: string) {
    return this.prisma.registrationDraft.findUnique({
      where: {
        panNumber,
      },
    });
  }

  async findRegistrationDraftByAadhaar(aadhaarNumber: string) {
    return this.prisma.registrationDraft.findUnique({
      where: {
        aadhaarNumber,
      },
    });
  }

  async updateRegistrationStep(
    draftId: string,
    registrationStep: RegistrationStep,
  ) {
    return this.prisma.registrationDraft.update({
      where: {
        id: draftId,
      },
      data: {
        registrationStep,
      },
    });
  }

  async updateRegistrationDraft(
    id: string,
    data: Prisma.RegistrationDraftUpdateInput,
  ) {
    return this.prisma.registrationDraft.update({
      where: {
        id,
      },
      data,
      include: {
        role: true,
      },
    });
  }

  async deleteRegistrationDraft(id: string) {
    return this.prisma.registrationDraft.delete({
      where: {
        id,
      },
    });
  }

  async completeRegistration(data: CompleteRegistrationData) {
    const identity = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.registrationDraft.findUnique({
        where: {
          id: data.draftId,
        },
        include: {
          role: true,
        },
      });

      if (!draft) {
        throw new BadRequestException('Registration draft not found');
      }

      if (!draft.role.isActive) {
        throw new BadRequestException('Selected role is inactive');
      }

      const updateRole = await tx.role.update({
        where: {
          id: draft.roleId,
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

      const numberPort = updateRole.lastLoginIdNumber
        .toString()
        .padStart(4, '0');
      const loginId = `${updateRole.prefix}${numberPort}`;

      const createdIdentity = await tx.identity.create({
        data: {
          ...data.identity,
          loginId,
          role: {
            connect: {
              id: updateRole.id,
            },
          },
        },
        include: {
          role: true,
        },
      });

      await tx.registrationDraft.delete({
        where: {
          id: data.draftId,
        },
      });

      return createdIdentity;
    });

    await this.clearIdentityCache(identity);

    return identity;
  }

  async updatePreferredLoginMethod(
    identityId: string,
    preferredLoginMethod: LoginMethod,
  ) {
    const identity = await this.prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        preferredLoginMethod,
      },
      include: {
        role: true,
      },
    });

    await this.clearIdentityCache(identity);

    return identity;
  }

  async updatePassword(identityId: string, password: string) {
    return this.prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        password,
        passwordChangedAt: new Date(),
      },
    });
  }

  async updateMpin(identityId: string, hashedMpin: string) {
    return this.prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        mpin: hashedMpin,
      },
    });
  }

  async createPasswordResetDraft(data: {
    identityId: string;
    expiresAt: Date;
  }) {
    return this.prisma.passwordResetDraft.create({
      data,
    });
  }

  async findPasswordResetDraft(id: string) {
    return this.prisma.passwordResetDraft.findUnique({
      where: { id },
      include: {
        identity: true,
      },
    });
  }

  async updatePasswordRestedDraft(
    id: string,
    data: {
      otpVerified?: boolean;
    },
  ) {
    return this.prisma.passwordResetDraft.update({
      where: { id },
      data,
    });
  }

  async deletePasswordResetDraft(id: string) {
    return this.prisma.passwordResetDraft.delete({
      where: {
        id,
      },
    });
  }

  async create(data: Prisma.IdentityCreateInput): Promise<IdentityWithRole> {
    const identity = await this.prisma.identity.create({
      data,
      include: {
        role: true,
      },
    });
    await this.clearIdentityCache(identity);
    return identity;
  }
}
