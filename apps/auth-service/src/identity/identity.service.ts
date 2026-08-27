import {
  LoginMethod,
  Prisma,
  RegistrationStep,
} from '../../generated/prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from 'libs/cache/src';
import { CompleteRegistrationData } from '../auth/types/register.type';
import { getSessionValidationVersionKey } from '@nexus/common/auth/constants/session-validation-cache.constants';

export type DuplicateField = 'email' | 'username' | 'phoneNumber' | null;

export type IdentityWithRole = Prisma.IdentityGetPayload<{
  include: {
    role: true;
  };
}>;

const loginIdentitySelect = {
  id: true,
  loginId: true,
  fullName: true,
  username: true,
  email: true,
  phoneNumber: true,
  password: true,
  mpin: true,
  status: true,
  passwordChangedAt: true,
  preferredLoginMethod: true,
  role: {
    select: {
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.IdentitySelect;

const peerTransferIdentitySelect = {
  id: true,
  loginId: true,
  fullName: true,
  status: true,
  roleId: true,
  role: {
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.IdentitySelect;

export type LoginIdentity = Prisma.IdentityGetPayload<{
  select: typeof loginIdentitySelect;
}>;

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async findByEmail(email: string): Promise<IdentityWithRole | null> {
    return await this.prisma.identity.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findByUsername(username: string): Promise<IdentityWithRole | null> {
    return await this.prisma.identity.findUnique({
      where: { username },
      include: {
        role: true,
      },
    });
  }

  async findByPhoneNumber(
    phoneNumber: string,
  ): Promise<IdentityWithRole | null> {
    return await this.prisma.identity.findUnique({
      where: { phoneNumber },
      include: { role: true },
    });
  }

  async findByLoginId(loginId: string): Promise<IdentityWithRole | null> {
    return await this.prisma.identity.findUnique({
      where: {
        loginId,
      },
      include: {
        role: true,
      },
    });
  }

  async findPeerTransferParticipants(
    senderUserId: string,
    receiverLoginId: string,
  ) {
    const normalizedReceiverLoginId = receiverLoginId.trim().toUpperCase();

    const [sender, receiver] = await Promise.all([
      this.prisma.identity.findUnique({
        where: {
          id: senderUserId,
        },
        select: peerTransferIdentitySelect,
      }),

      this.prisma.identity.findUnique({
        where: {
          loginId: normalizedReceiverLoginId,
        },
        select: peerTransferIdentitySelect,
      }),
    ]);

    return {
      sender,
      receiver,
    };
  }

  async findById(id: string) {
    return await this.prisma.identity.findUnique({
      where: {
        id,
      },
    });
  }

  async findByIdentifier(identifier: string): Promise<LoginIdentity | null> {
    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier) {
      return null;
    }
    let identities = await this.prisma.identity.findMany({
      where: {
        OR: [
          {
            email: normalizedIdentifier,
            preferredLoginMethod: LoginMethod.EMAIL,
          },
          {
            username: normalizedIdentifier,
            preferredLoginMethod: LoginMethod.USERNAME,
          },
          {
            loginId: normalizedIdentifier,
            preferredLoginMethod: LoginMethod.LOGIN_ID,
          },
          {
            phoneNumber: normalizedIdentifier,
            preferredLoginMethod: LoginMethod.PHONENUMBER,
          },
        ],
      },
      select: loginIdentitySelect,
      take: 4,
    });
    const emailIdentity = identities.find(
      (identity) =>
        identity.email === normalizedIdentifier &&
        identity.preferredLoginMethod === LoginMethod.EMAIL,
    );

    if (emailIdentity) {
      return emailIdentity;
    }

    const usernameIdentity = identities.find(
      (identity) =>
        identity.username === normalizedIdentifier &&
        identity.preferredLoginMethod === LoginMethod.USERNAME,
    );

    if (usernameIdentity) {
      return usernameIdentity;
    }

    const loginIdIdentity = identities.find(
      (identity) =>
        identity.loginId === normalizedIdentifier &&
        identity.preferredLoginMethod === LoginMethod.LOGIN_ID,
    );
    if (loginIdIdentity) {
      return loginIdIdentity;
    }

    const phoneIdentity = identities.find(
      (identity) =>
        identity.phoneNumber === normalizedIdentifier &&
        identity.preferredLoginMethod === LoginMethod.PHONENUMBER,
    );

    return phoneIdentity ?? null;
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
    id?: string | null;
    email?: string | null;
    username?: string | null;
    loginId?: string | null;
    phoneNumber?: string | null;
  }): Promise<void> {
    const keys: string[] = [];
    if (identity.id) {
      keys.push(
        `identity:id:${identity.id}`,
        `identity:profile:${identity.id}`,
      );
    }
    if (identity.email) {
      keys.push(`identity:email:${identity.email}`);
    }

    if (identity.username) {
      keys.push(`identity:username:${identity.username}`);
    }

    if (identity.loginId) {
      keys.push(`identity:loginId:${identity.loginId}`);
    }

    if (identity.phoneNumber) {
      keys.push(`identity:phone:${identity.phoneNumber}`);
    }

    if (keys.length > 0) {
      await this.cacheService.del(...keys);
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

  async resetPasswordWithVerifiedDraft(data: {
    draftId: string;
    identityId: string;
    hashedPassword: string;
  }): Promise<{
    revokedSessionCount: number;
  }> {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const consumedDraft = await tx.passwordResetDraft.deleteMany({
        where: {
          id: data.draftId,
          identityId: data.identityId,
          otpVerified: true,
          expiresAt: {
            gt: now,
          },
        },
      });

      if (consumedDraft.count !== 1) {
        throw new BadRequestException(
          'Password reset request is invalid, expired, or already used',
        );
      }

      const identity = await tx.identity.update({
        where: {
          id: data.identityId,
        },
        data: {
          password: data.hashedPassword,
          passwordChangedAt: now,
        },
      });

      const revokedSessions = await tx.session.updateMany({
        where: {
          identityId: data.identityId,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      return {
        identity,
        revokedSessionCount: revokedSessions.count,
      };
    });

    if (result.revokedSessionCount > 0) {
      await this.advanceSessionValidationCacheVersion(data.identityId);
    }

    try {
      await this.clearIdentityCache(result.identity);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown identity cache invalidation error';

      this.logger.error(
        `Password was reset, but identity cache invalidation failed: ${message}`,
      );
    }

    return {
      revokedSessionCount: result.revokedSessionCount,
    };
  }

  async changePasswordAndRevokeOtherSessions(data: {
    identityId: string;
    currentSessionId: string;
    expectedCurrentPasswordHash: string;
    hashedPassword: string;
  }): Promise<{
    revokedSessionCount: number;
  }> {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const currentSession = await tx.session.updateMany({
        where: {
          id: data.currentSessionId,
          identityId: data.identityId,
          revoked: false,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          lastUsedAt: now,
        },
      });

      if (currentSession.count !== 1) {
        throw new UnauthorizedException('Current session is no longer valid');
      }

      const passwordUpdate = await tx.identity.updateMany({
        where: {
          id: data.identityId,
          password: data.expectedCurrentPasswordHash,
        },
        data: {
          password: data.hashedPassword,
          passwordChangedAt: now,
        },
      });

      if (passwordUpdate.count !== 1) {
        throw new ConflictException(
          'Password was changed by another request. Please try again.',
        );
      }

      const revokedSessions = await tx.session.updateMany({
        where: {
          identityId: data.identityId,
          id: {
            not: data.currentSessionId,
          },
          revoked: false,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          revoked: true,
        },
      });

      const identity = await tx.identity.findUnique({
        where: {
          id: data.identityId,
        },
        select: {
          id: true,
          email: true,
          username: true,
          loginId: true,
          phoneNumber: true,
        },
      });

      if (!identity) {
        throw new BadRequestException('User not found');
      }

      return {
        identity,
        revokedSessionCount: revokedSessions.count,
      };
    });

    if (result.revokedSessionCount > 0) {
      await this.advanceSessionValidationCacheVersion(data.identityId);
    }

    try {
      await this.clearIdentityCache(result.identity);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown identity cache invalidation error';

      this.logger.error(
        `Password changed, but identity cache invalidation failed: ${message}`,
      );
    }

    return {
      revokedSessionCount: result.revokedSessionCount,
    };
  }

  async changeMpinAndRevokeOtherSessions(data: {
    identityId: string;
    currentSessionId: string;
    expectedCurrentMpinHash: string;
    hashedMpin: string;
  }): Promise<{
    revokedSessionCount: number;
  }> {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const currentSession = await tx.session.updateMany({
        where: {
          id: data.currentSessionId,
          identityId: data.identityId,
          revoked: false,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          lastUsedAt: now,
        },
      });

      if (currentSession.count !== 1) {
        throw new UnauthorizedException('Current session is no longer valid');
      }

      const mpinUpdate = await tx.identity.updateMany({
        where: {
          id: data.identityId,
          mpin: data.expectedCurrentMpinHash,
        },
        data: {
          mpin: data.hashedMpin,
        },
      });

      if (mpinUpdate.count !== 1) {
        throw new ConflictException(
          'MPIN was changed by another request. Please try again.',
        );
      }

      const revokedSessions = await tx.session.updateMany({
        where: {
          identityId: data.identityId,
          id: {
            not: data.currentSessionId,
          },
          revoked: false,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          revoked: true,
        },
      });

      const identity = await tx.identity.findUnique({
        where: {
          id: data.identityId,
        },
        select: {
          id: true,
          email: true,
          username: true,
          loginId: true,
          phoneNumber: true,
        },
      });

      if (!identity) {
        throw new BadRequestException('User not found');
      }

      return {
        identity,
        revokedSessionCount: revokedSessions.count,
      };
    });

    if (result.revokedSessionCount > 0) {
      await this.advanceSessionValidationCacheVersion(data.identityId);
    }

    try {
      await this.clearIdentityCache(result.identity);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown identity cache invalidation error';

      this.logger.error(
        `MPIN changed, but identity cache invalidation failed: ${message}`,
      );
    }

    return {
      revokedSessionCount: result.revokedSessionCount,
    };
  }

  async updatePassword(identityId: string, password: string) {
    const identity = await this.prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        password,
        passwordChangedAt: new Date(),
      },
    });
    await this.clearIdentityCache(identity);
    return identity;
  }

  async updateMpin(identityId: string, hashedMpin: string) {
    const identity = await this.prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        mpin: hashedMpin,
      },
    });

    await this.clearIdentityCache(identity);
    return identity;
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
        identity: { include: { role: true } },
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
