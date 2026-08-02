import { LoginMethod, Prisma } from '../../generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from 'libs/cache/src';

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

    if (identity?.preferredLoginMethod === LoginMethod.PHONE_PASSWORD) {
      return identity;
    }

    return null;
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

  async generateLoginId(): Promise<string> {
    const lastUser = await this.prisma.identity.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        loginId: true,
      },
    });

    let nextNumber = 1;

    if (lastUser?.loginId) {
      const numericPart = Number(lastUser.loginId.replace(/^KUR/, ''));

      if (!Number.isNaN(numericPart)) {
        nextNumber = numericPart + 1;
      }
    }

    return `KUR${nextNumber.toString().padStart(6, '0')}`;
  }

  async updateLastLogin(identityId: string) {
    const identity = await this.prisma.identity.update({
      where: {
        id: identityId,
      },
      data: {
        lastLoginAt: new Date(),
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
