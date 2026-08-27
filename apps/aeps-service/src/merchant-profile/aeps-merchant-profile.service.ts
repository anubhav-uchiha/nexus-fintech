import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AepsMerchantStatus, AepsProvider } from '../../generated/prisma/enums';

import { PrismaService } from '../database/prisma.service';

interface PrepareProviderRegistrationInput {
  bankAccountId?: string;
  kycProfileId?: string;
}

interface MarkProviderRegisteredInput {
  providerMerchantId: string;
  providerUserCode?: string;
}

@Injectable()
export class AepsMerchantProfileService {
  constructor(private readonly prisma: PrismaService) {}

  findProfile(identityId: string, provider: AepsProvider) {
    return this.prisma.aepsMerchantProfile.findUnique({
      where: {
        identityId_provider: {
          identityId,
          provider,
        },
      },
    });
  }

  async getProfileOrThrow(identityId: string, provider: AepsProvider) {
    const profile = await this.findProfile(identityId, provider);

    if (!profile) {
      throw new NotFoundException('AEPS merchant profile not found');
    }

    return profile;
  }

  async prepareProviderRegistration(
    identityId: string,
    provider: AepsProvider,
    input: PrepareProviderRegistrationInput,
  ) {
    let profile = await this.prisma.aepsMerchantProfile.upsert({
      where: {
        identityId_provider: {
          identityId,
          provider,
        },
      },

      create: {
        identityId,
        provider,

        bankAccountId: input.bankAccountId,

        kycProfileId: input.kycProfileId,

        status: AepsMerchantStatus.ONBOARDING,
      },

      update: {},
    });

    if (
      profile.status === AepsMerchantStatus.BLOCKED ||
      profile.status === AepsMerchantStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        `AEPS provider profile is ${profile.status.toLowerCase()}`,
      );
    }

    /*
     * Provider registration already done.
     * External registration API dobara hit nahi hogi.
     */
    if (profile.providerRegistrationCompleted || profile.providerMerchantId) {
      return {
        profile,
        shouldCallProvider: false,
      };
    }

    /*
     * Previous attempt failed/rejected.
     * Fresh provider registration attempt allow karenge.
     */
    if (
      profile.status === AepsMerchantStatus.REJECTED ||
      profile.status === AepsMerchantStatus.FAILED
    ) {
      profile = await this.prisma.aepsMerchantProfile.update({
        where: {
          id: profile.id,
        },

        data: {
          bankAccountId: input.bankAccountId,

          kycProfileId: input.kycProfileId,

          providerMerchantId: null,
          providerUserCode: null,

          status: AepsMerchantStatus.ONBOARDING,

          providerRegistrationCompleted: false,

          onboardingCompleted: false,

          serviceActivated: false,

          statusReason: null,

          providerRegisteredAt: null,

          onboardedAt: null,

          activatedAt: null,
        },
      });

      return {
        profile,
        shouldCallProvider: true,
      };
    }

    profile = await this.prisma.aepsMerchantProfile.update({
      where: {
        id: profile.id,
      },

      data: {
        bankAccountId: input.bankAccountId,

        kycProfileId: input.kycProfileId,

        status: AepsMerchantStatus.ONBOARDING,

        statusReason: null,
      },
    });

    return {
      profile,
      shouldCallProvider: true,
    };
  }

  async markProviderRegistered(
    identityId: string,
    provider: AepsProvider,
    input: MarkProviderRegisteredInput,
  ) {
    return this.prisma.aepsMerchantProfile.update({
      where: {
        identityId_provider: {
          identityId,
          provider,
        },
      },

      data: {
        providerMerchantId: input.providerMerchantId,

        providerUserCode: input.providerUserCode,

        providerRegistrationCompleted: true,

        /*
         * Full onboarding abhi complete nahi.
         */
        onboardingCompleted: false,

        serviceActivated: false,

        /*
         * VimoPay registration ke baad
         * OTP next action hai.
         */
        status: AepsMerchantStatus.ACTION_REQUIRED,

        providerRegisteredAt: new Date(),

        statusReason: null,
      },
    });
  }

  async markActionRequired(
    identityId: string,
    provider: AepsProvider,
    reason?: string,
  ) {
    return this.prisma.aepsMerchantProfile.update({
      where: {
        identityId_provider: {
          identityId,
          provider,
        },
      },

      data: {
        status: AepsMerchantStatus.ACTION_REQUIRED,

        statusReason: reason?.slice(0, 500) ?? null,

        serviceActivated: false,
      },
    });
  }

  async markUnderReview(
    identityId: string,
    provider: AepsProvider,
    reason?: string,
  ) {
    return this.prisma.aepsMerchantProfile.update({
      where: {
        identityId_provider: {
          identityId,
          provider,
        },
      },

      data: {
        status: AepsMerchantStatus.UNDER_REVIEW,

        statusReason: reason?.slice(0, 500) ?? null,

        serviceActivated: false,
      },
    });
  }

  async markOnboardingCompleted(
    identityId: string,
    provider: AepsProvider,
    nextStatus: AepsMerchantStatus = AepsMerchantStatus.UNDER_REVIEW,
  ) {
    return this.prisma.aepsMerchantProfile.update({
      where: {
        identityId_provider: {
          identityId,
          provider,
        },
      },

      data: {
        onboardingCompleted: true,

        onboardedAt: new Date(),

        status: nextStatus,

        statusReason: null,
      },
    });
  }

  async markActive(identityId: string, provider: AepsProvider) {
    const profile = await this.getProfileOrThrow(identityId, provider);

    const now = new Date();

    return this.prisma.aepsMerchantProfile.update({
      where: {
        id: profile.id,
      },

      data: {
        providerRegistrationCompleted: true,

        onboardingCompleted: true,

        serviceActivated: true,

        status: AepsMerchantStatus.ACTIVE,

        onboardedAt: profile.onboardedAt ?? now,

        activatedAt: profile.activatedAt ?? now,

        statusReason: null,
      },
    });
  }

  async markFailed(identityId: string, provider: AepsProvider, reason: string) {
    const profile = await this.getProfileOrThrow(identityId, provider);

    return this.prisma.aepsMerchantProfile.update({
      where: {
        id: profile.id,
      },

      data: {
        status: AepsMerchantStatus.FAILED,

        serviceActivated: false,

        statusReason: reason.slice(0, 500),
      },
    });
  }

  async markRejected(
    identityId: string,
    provider: AepsProvider,
    reason: string,
  ) {
    const profile = await this.getProfileOrThrow(identityId, provider);

    return this.prisma.aepsMerchantProfile.update({
      where: {
        id: profile.id,
      },

      data: {
        status: AepsMerchantStatus.REJECTED,

        serviceActivated: false,

        statusReason: reason.slice(0, 500),
      },
    });
  }

  async markSuspended(
    identityId: string,
    provider: AepsProvider,
    reason?: string,
  ) {
    const profile = await this.getProfileOrThrow(identityId, provider);

    return this.prisma.aepsMerchantProfile.update({
      where: {
        id: profile.id,
      },

      data: {
        status: AepsMerchantStatus.SUSPENDED,

        serviceActivated: false,

        statusReason: reason?.slice(0, 500) ?? null,
      },
    });
  }

  async markBlocked(
    identityId: string,
    provider: AepsProvider,
    reason?: string,
  ) {
    const profile = await this.getProfileOrThrow(identityId, provider);

    return this.prisma.aepsMerchantProfile.update({
      where: {
        id: profile.id,
      },

      data: {
        status: AepsMerchantStatus.BLOCKED,

        serviceActivated: false,

        statusReason: reason?.slice(0, 500) ?? null,
      },
    });
  }

  async markStatusChecked(identityId: string, provider: AepsProvider) {
    return this.prisma.aepsMerchantProfile.update({
      where: {
        identityId_provider: {
          identityId,
          provider,
        },
      },

      data: {
        lastStatusCheckedAt: new Date(),
      },
    });
  }
}
