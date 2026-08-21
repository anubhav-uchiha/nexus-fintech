import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  AepsMerchantStatus,
  AepsProvider,
} from 'apps/aeps-service/generated/prisma/enums';
import { randomInt } from 'crypto';

@Injectable()
export class AepsMerchantProfileService {
  constructor(private readonly prisma: PrismaService) {}

  findEkoProfile(identityId: string) {
    return this.prisma.aepsMerchantProfile.findUnique({
      where: {
        identityId_provider: {
          identityId,
          provider: AepsProvider.EKO,
        },
      },
    });
  }
  async prepareEkoOnboarding(identityId: string) {
    const newClientRefId = this.generateClientRefId();
    let profile = await this.prisma.aepsMerchantProfile.upsert({
      where: {
        identityId_provider: {
          identityId,
          provider: AepsProvider.EKO,
        },
      },
      create: {
        identityId,
        provider: AepsProvider.EKO,
        status: AepsMerchantStatus.ONBOARDING,
        onboardingClientRefId: newClientRefId,
      },
      update: {},
    });

    if (profile.onboardingCompleted || profile.providerUserCode) {
      return {
        profile,
        shouldCallProvider: false,
      };
    }

    if (
      profile.status === AepsMerchantStatus.BLOCKED ||
      profile.status === AepsMerchantStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        `AEPS merchant onboarding is  ${profile.status.toLowerCase()}`,
      );
    }

    if (profile.status === AepsMerchantStatus.REJECTED) {
      profile = await this.prisma.aepsMerchantProfile.update({
        where: {
          id: profile.id,
        },
        data: {
          status: AepsMerchantStatus.ONBOARDING,
          onboardingClientRefId: newClientRefId,
          rejectionReason: null,
        },
      });
      return {
        profile,
        shouldCallProvider: true,
      };
    }

    if (!profile.onboardingClientRefId) {
      profile = await this.prisma.aepsMerchantProfile.update({
        where: {
          id: profile.id,
        },
        data: {
          status: AepsMerchantStatus.ONBOARDING,
          onboardingClientRefId: newClientRefId,
        },
      });
    } else if (profile.status !== AepsMerchantStatus.ONBOARDING) {
      profile = await this.prisma.aepsMerchantProfile.update({
        where: {
          id: profile.id,
        },
        data: {
          status: AepsMerchantStatus.ONBOARDING,
        },
      });
    }
    return {
      profile,
      shouldCallProvider: true,
    };
  }

  async markEkoOnboardingCompleted(
    identityId: string,
    providerUserCode: string,
    providerMerchantId?: string,
  ) {
    return this.prisma.aepsMerchantProfile.update({
      where: {
        identityId_provider: {
          identityId,
          provider: AepsProvider.EKO,
        },
      },
      data: {
        providerUserCode,
        providerMerchantId,
        status: AepsMerchantStatus.KYC_PENDING,
        onboardingCompleted: true,
        onboardedAt: new Date(),
        rejectionReason: null,
      },
    });
  }

  async markEkoOnboardingRejected(identityId: string, reason: string) {
    const profile = await this.findEkoProfile(identityId);

    if (!profile) {
      throw new NotFoundException('AEPS merchant profile not found');
    }

    return this.prisma.aepsMerchantProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        status: AepsMerchantStatus.REJECTED,
        rejectionReason: reason.slice(0, 500),
      },
    });
  }

  private generateClientRefId(): string {
    return `${Date.now()}${randomInt(100000, 1000000)}`;
  }
}
