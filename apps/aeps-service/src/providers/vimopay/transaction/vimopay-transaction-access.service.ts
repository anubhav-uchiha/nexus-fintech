import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import {
  AepsMerchantStatus,
  AepsProvider,
  VimopayOnboardingStep,
} from '../../../../generated/prisma/enums';

import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class VimopayTransactionAccessService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getActiveMerchant(
    identityId: string,
  ) {
    const profile =
      await this.prisma.aepsMerchantProfile.findUnique({
        where: {
          identityId_provider: {
            identityId,
            provider: AepsProvider.VIMOPAY,
          },
        },
        include: {
          vimopayDetail: true,
        },
      });

    if (!profile) {
      throw new BadRequestException(
        'VimoPay merchant onboarding is required',
      );
    }

    if (
      profile.status ===
        AepsMerchantStatus.BLOCKED ||
      profile.status ===
        AepsMerchantStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        `VimoPay merchant is ${profile.status.toLowerCase()}`,
      );
    }

    if (
      profile.status !==
        AepsMerchantStatus.ACTIVE ||
      !profile.serviceActivated
    ) {
      throw new ForbiddenException(
        'VimoPay merchant is not active',
      );
    }

    if (!profile.providerMerchantId) {
      throw new BadRequestException(
        'VimoPay merchant ID is missing',
      );
    }

    const detail =
      profile.vimopayDetail;

    if (!detail) {
      throw new BadRequestException(
        'VimoPay merchant details are missing',
      );
    }

    if (
      detail.onboardingStep !==
      VimopayOnboardingStep.ACTIVE
    ) {
      throw new ForbiddenException(
        'VimoPay onboarding is not active',
      );
    }

    if (!detail.lastTwoFactorAuthAt) {
      throw new ForbiddenException(
        'VimoPay 2FA is required before transactions',
      );
    }

    if (
      !this.isSameIndianDay(
        detail.lastTwoFactorAuthAt,
        new Date(),
      )
    ) {
      throw new ForbiddenException({
        message:
          'VimoPay daily 2FA is required before transactions',

        code:
          'VIMOPAY_2FA_REQUIRED',
      });
    }

    return {
      profileId:
        profile.id,

      identityId:
        profile.identityId,

      merchantId:
        profile.providerMerchantId,

      bankAccountId:
        profile.bankAccountId,

      kycProfileId:
        profile.kycProfileId,

      lastTwoFactorAuthAt:
        detail.lastTwoFactorAuthAt,
    };
  }

  private isSameIndianDay(
    first: Date,
    second: Date,
  ): boolean {
    const formatter =
      new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone:
            'Asia/Kolkata',

          year:
            'numeric',

          month:
            '2-digit',

          day:
            '2-digit',
        },
      );

    return (
      formatter.format(first) ===
      formatter.format(second)
    );
  }
}