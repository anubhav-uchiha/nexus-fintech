import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { randomInt } from 'crypto';

import {
  AepsMerchantStatus,
  AepsProvider,
  VimopayOnboardingStep,
} from '../../../../generated/prisma/enums';

import { PrismaService } from '../../../database/prisma.service';

import { AepsMerchantProfileService } from '../../../merchant-profile/aeps-merchant-profile.service';

import { AepsBankService } from '../../../integrations/bank/aeps-bank.service';

import { AepsKycService } from '../../../integrations/kyc/aeps-kyc.service';

import { VimopayService } from '../vimopay.service';

import { VimopayMerchantRegistrationDto } from '../dto/merchant-registration.dto';

import { VimopayRegisterDto } from './dto/vimopay-register.dto';

import { VimopayVerifyOtpDto } from './dto/vimopay-verify-otp.dto';
import { VimopayEkycDto } from './dto/vimopay-ekyc.dto';

import { VimopayTwoFactorDto } from './dto/vimopay-two-factor.dto';

export interface VimopayRequestContext {
  identityId: string;
  ipAddress: string;
}

@Injectable()
export class VimopayOnboardingService {
  private readonly logger = new Logger(VimopayOnboardingService.name);

  private readonly provider = AepsProvider.VIMOPAY;

  constructor(
    private readonly prisma: PrismaService,

    private readonly profileService: AepsMerchantProfileService,

    private readonly bankService: AepsBankService,

    private readonly kycService: AepsKycService,

    private readonly vimopayService: VimopayService,

    private readonly configService: ConfigService,
  ) {}

  /*
   * =====================================================
   * MERCHANT REGISTRATION
   * =====================================================
   */

  async register(context: VimopayRequestContext, dto: VimopayRegisterDto) {
    const { identityId, ipAddress } = context;

    /*
     * 1. KYC ownership + approval.
     */
    await this.kycService.verifyApprovedKyc(identityId, dto.kycProfileId);

    /*
     * 2. Bank ownership + verification.
     */
    const bank = await this.bankService.getVerifiedBankAccount(
      identityId,
      dto.bankAccountId,
    );

    const accountType = this.bankService.mapAccountTypeForVimopay(bank);

    /*
     * 3. VimoPay Bank List code check.
     */
    const vimopayBanks = await this.vimopayService.getBankList();

    const selectedVimopayBank = vimopayBanks.find(
      (item) => item.code.trim() === dto.vimopayBankCode.trim(),
    );

    if (!selectedVimopayBank) {
      throw new BadRequestException('Invalid VimoPay bank code');
    }

    /*
     * 4. Prepare common provider profile.
     */
    const { profile, shouldCallProvider } =
      await this.profileService.prepareProviderRegistration(
        identityId,
        this.provider,
        {
          bankAccountId: dto.bankAccountId,

          kycProfileId: dto.kycProfileId,
        },
      );

    const pipe = this.getPipe();

    /*
     * 5. Already registered.
     */
    if (!shouldCallProvider) {
      let detail = await this.prisma.vimopayMerchantDetail.findUnique({
        where: {
          profileId: profile.id,
        },
      });

      /*
       * Common provider profile exists,
       * but provider-detail row somehow missing.
       *
       * External registration dobara hit nahi karenge.
       */
      if (!detail) {
        detail = await this.prisma.vimopayMerchantDetail.create({
          data: {
            profileId: profile.id,

            pipe,

            onboardingStep: profile.serviceActivated
              ? VimopayOnboardingStep.ACTIVE
              : VimopayOnboardingStep.OTP_PENDING,

            lastProviderStatusMessage:
              'Provider registration already completed',
          },
        });
      }

      return {
        provider: this.provider,

        skipped: true,

        profileId: profile.id,

        providerMerchantId: profile.providerMerchantId,

        status: profile.status,

        onboardingStep: detail.onboardingStep,

        message: 'Merchant registration already completed with VimoPay',
      };
    }

    /*
     * 6. New provider request ref.
     */
    const merchantRefId = this.generateMerchantRefId('REG');

    /*
     * Request attempt DB mein pehle record karenge.
     */
    await this.prisma.vimopayMerchantDetail.upsert({
      where: {
        profileId: profile.id,
      },

      create: {
        profileId: profile.id,

        pipe,

        onboardingStep: VimopayOnboardingStep.REGISTRATION_PENDING,

        registrationClientRefId: merchantRefId,
      },

      update: {
        pipe,

        onboardingStep: VimopayOnboardingStep.REGISTRATION_PENDING,

        registrationClientRefId: merchantRefId,

        registrationTxnRefId: null,

        lastProviderStatusCode: null,

        lastProviderStatusMessage: null,
      },
    });

    /*
     * 7. Build provider payload.
     */
    const providerDto: VimopayMerchantRegistrationDto = {
      merchantRefId,

      ipAddress,

      lat: dto.lat,

      long: dto.long,

      firstName: dto.firstName,

      middleName: dto.middleName ?? '',

      lastName: dto.lastName,

      dob: dto.dob,

      merchantPhoneNumber: dto.merchantPhoneNumber,

      merchantAddress1: dto.merchantAddress1,

      merchantAddress2: dto.merchantAddress2 ?? '',

      merchantState: dto.merchantState,

      merchantDistrict: dto.merchantDistrict,

      gender: dto.gender,

      merchantPinCode: dto.merchantPinCode,

      emailId: dto.emailId,

      merchantPan: dto.merchantPan,

      aadhaarNumber: dto.aadhaarNumber,

      shopPan: dto.shopPan,

      /*
       * Trusted bank-service values.
       */
      bankAccountNumber: bank.accountNumber,

      bankIfscCode: bank.ifsc,

      /*
       * VimoPay Bank List code.
       */
      bankName: dto.vimopayBankCode,

      accountType,

      shopAddress: dto.shopAddress,

      shopDistrict: dto.shopDistrict,

      shopState: dto.shopState,

      shopPincode: dto.shopPincode,

      shopLat: dto.shopLat,

      shopLong: dto.shopLong,
    };

    try {
      const result = await this.vimopayService.registerMerchant(providerDto);

      /*
       * Common profile FIRST.
       *
       * External merchant already created hai.
       * Agar next detail update fail ho,
       * registration duplicate nahi honi chahiye.
       */
      const updatedProfile = await this.profileService.markProviderRegistered(
        identityId,
        this.provider,
        {
          providerMerchantId: result.merchantId,
        },
      );

      const detail = await this.prisma.vimopayMerchantDetail.update({
        where: {
          profileId: profile.id,
        },

        data: {
          onboardingStep: VimopayOnboardingStep.OTP_PENDING,

          registrationTxnRefId: result.txnRefId,

          lastProviderStatusCode: result.status,

          lastProviderStatusMessage: result.statusDescription,
        },
      });

      return {
        provider: this.provider,

        skipped: false,

        profileId: updatedProfile.id,

        providerMerchantId: updatedProfile.providerMerchantId,

        status: updatedProfile.status,

        onboardingStep: detail.onboardingStep,

        merchantRefId: result.merchantRefId,

        txnRefId: result.txnRefId,

        message: result.statusDescription,
      };
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);

      if (error instanceof BadRequestException) {
        await this.profileService.markRejected(
          identityId,
          this.provider,
          message,
        );

        await this.updateFailureDetail(
          profile.id,
          VimopayOnboardingStep.REJECTED,
          message,
        );
      } else {
        await this.profileService.markFailed(
          identityId,
          this.provider,
          message,
        );

        await this.updateFailureDetail(
          profile.id,
          VimopayOnboardingStep.FAILED,
          message,
        );
      }

      throw error;
    }
  }

  /*
   * =====================================================
   * SEND OTP
   * =====================================================
   */

  async sendOtp(identityId: string) {
    const { profile, detail, merchantId } =
      await this.getRegisteredMerchantState(identityId);

    /*
     * OTP already verified hai to provider ko
     * Send OTP dobara hit nahi karenge.
     */
    if (this.isOtpCompleted(detail)) {
      return {
        provider: this.provider,

        skipped: true,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: profile.status,

        onboardingStep: detail.onboardingStep,

        message: 'VimoPay merchant OTP is already verified',
      };
    }

    this.assertOtpPending(detail.onboardingStep);

    const merchantRefId = this.generateMerchantRefId('OTP');

    try {
      const result = await this.vimopayService.sendMerchantOtp({
        merchantId,

        merchantRefId,
      });

      const now = new Date();

      await this.prisma.$transaction([
        this.prisma.vimopayMerchantDetail.update({
          where: {
            profileId: profile.id,
          },

          data: {
            onboardingStep: VimopayOnboardingStep.OTP_PENDING,

            lastOtpClientRefId: merchantRefId,

            lastOtpTxnRefId: result.txnRefId,

            lastOtpSentAt: now,

            lastProviderStatusCode: result.status,

            lastProviderStatusMessage: result.statusDescription,
          },
        }),

        this.prisma.aepsMerchantProfile.update({
          where: {
            id: profile.id,
          },

          data: {
            status: AepsMerchantStatus.ACTION_REQUIRED,

            statusReason: 'VimoPay OTP verification required',

            serviceActivated: false,
          },
        }),
      ]);

      return {
        provider: this.provider,

        skipped: false,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: AepsMerchantStatus.ACTION_REQUIRED,

        onboardingStep: VimopayOnboardingStep.OTP_PENDING,

        merchantRefId,

        txnRefId: result.txnRefId,

        message: result.statusDescription,
      };
    } catch (error: unknown) {
      await this.recordStepError(profile.id, error);

      throw error;
    }
  }

  /*
   * =====================================================
   * RESEND OTP
   * =====================================================
   */

  async resendOtp(identityId: string) {
    const { profile, detail, merchantId } =
      await this.getRegisteredMerchantState(identityId);

    if (this.isOtpCompleted(detail)) {
      return {
        provider: this.provider,

        skipped: true,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: profile.status,

        onboardingStep: detail.onboardingStep,

        message: 'VimoPay merchant OTP is already verified',
      };
    }

    this.assertOtpPending(detail.onboardingStep);

    const merchantRefId = this.generateMerchantRefId('RTO');

    try {
      const result = await this.vimopayService.resendMerchantOtp({
        merchantId,

        merchantRefId,
      });

      const now = new Date();

      await this.prisma.$transaction([
        this.prisma.vimopayMerchantDetail.update({
          where: {
            profileId: profile.id,
          },

          data: {
            onboardingStep: VimopayOnboardingStep.OTP_PENDING,

            lastOtpClientRefId: merchantRefId,

            lastOtpTxnRefId: result.txnRefId,

            lastOtpSentAt: now,

            lastProviderStatusCode: result.status,

            lastProviderStatusMessage: result.statusDescription,
          },
        }),

        this.prisma.aepsMerchantProfile.update({
          where: {
            id: profile.id,
          },

          data: {
            status: AepsMerchantStatus.ACTION_REQUIRED,

            statusReason: 'VimoPay OTP verification required',
          },
        }),
      ]);

      return {
        provider: this.provider,

        skipped: false,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: AepsMerchantStatus.ACTION_REQUIRED,

        onboardingStep: VimopayOnboardingStep.OTP_PENDING,

        merchantRefId,

        txnRefId: result.txnRefId,

        message: result.statusDescription,
      };
    } catch (error: unknown) {
      await this.recordStepError(profile.id, error);

      throw error;
    }
  }

  /*
   * =====================================================
   * VERIFY OTP
   * =====================================================
   */

  async verifyOtp(identityId: string, dto: VimopayVerifyOtpDto) {
    const { profile, detail, merchantId } =
      await this.getRegisteredMerchantState(identityId);

    /*
     * Idempotency.
     *
     * OTP already verify ho chuka hai to provider
     * ko duplicate validation call nahi karenge.
     */
    if (this.isOtpCompleted(detail)) {
      return {
        provider: this.provider,

        skipped: true,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: profile.status,

        onboardingStep: detail.onboardingStep,

        message: 'VimoPay merchant OTP is already verified',
      };
    }

    this.assertOtpPending(detail.onboardingStep);

    const merchantRefId = this.generateMerchantRefId('OTV');

    try {
      const result = await this.vimopayService.validateMerchantOtp({
        merchantId,

        merchantRefId,

        otp: dto.otp,
      });

      const now = new Date();

      /*
       * OTP verified.
       *
       * Current next action:
       * E-KYC.
       */
      await this.prisma.$transaction([
        this.prisma.vimopayMerchantDetail.update({
          where: {
            profileId: profile.id,
          },

          data: {
            onboardingStep: VimopayOnboardingStep.EKYC_PENDING,

            otpVerifyClientRefId: merchantRefId,

            otpVerifyTxnRefId: result.txnRefId,

            otpVerifiedAt: now,

            lastProviderStatusCode: result.status,

            lastProviderStatusMessage: result.statusDescription,
          },
        }),

        this.prisma.aepsMerchantProfile.update({
          where: {
            id: profile.id,
          },

          data: {
            status: AepsMerchantStatus.ACTION_REQUIRED,

            statusReason: 'VimoPay E-KYC required',

            serviceActivated: false,
          },
        }),
      ]);

      return {
        provider: this.provider,

        skipped: false,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: AepsMerchantStatus.ACTION_REQUIRED,

        onboardingStep: VimopayOnboardingStep.EKYC_PENDING,

        merchantRefId,

        txnRefId: result.txnRefId,

        message: result.statusDescription,

        nextAction: 'EKYC',
      };
    } catch (error: unknown) {
      /*
       * Wrong OTP ko merchant rejection nahi maanenge.
       *
       * Profile OTP_PENDING hi rahegi.
       */
      await this.recordStepError(profile.id, error);

      throw error;
    }
  }

  /*
   * =====================================================
   * E-KYC
   * =====================================================
   */

  private isEkycCompleted(detail: {
    onboardingStep: VimopayOnboardingStep;

    ekycCompletedAt: Date | null;
  }): boolean {
    if (detail.ekycCompletedAt) {
      return true;
    }

    const completedSteps: VimopayOnboardingStep[] = [
      VimopayOnboardingStep.EKYC_COMPLETED,

      VimopayOnboardingStep.TWO_FA_PENDING,

      VimopayOnboardingStep.ACTIVE,
    ];

    return completedSteps.includes(detail.onboardingStep);
  }

  async completeEkyc(identityId: string, dto: VimopayEkycDto) {
    const { profile, detail, merchantId } =
      await this.getRegisteredMerchantState(identityId);

    /*
     * E-KYC already complete ho chuki hai.
     *
     * Provider ko duplicate biometric
     * request dobara nahi bhejenge.
     */
    if (this.isEkycCompleted(detail)) {
      return {
        provider: this.provider,

        skipped: true,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: profile.status,

        onboardingStep: detail.onboardingStep,

        message: 'VimoPay merchant E-KYC is already completed',
      };
    }

    /*
     * OTP complete hona mandatory hai.
     */
    if (!detail.otpVerifiedAt) {
      throw new BadRequestException(
        'VimoPay merchant OTP must be verified before E-KYC',
      );
    }

    if (detail.onboardingStep !== VimopayOnboardingStep.EKYC_PENDING) {
      throw new BadRequestException(
        `VimoPay E-KYC is not allowed in ${detail.onboardingStep} state`,
      );
    }

    const merchantRefId = this.generateMerchantRefId('KYC');

    try {
      const result = await this.vimopayService.merchantEkyc({
        merchantId,

        merchantRefId,

        pidData: dto.pidData,
      });

      const now = new Date();

      /*
       * E-KYC complete.
       *
       * Next VimoPay step = 2FA.
       */
      await this.prisma.$transaction([
        this.prisma.vimopayMerchantDetail.update({
          where: {
            profileId: profile.id,
          },

          data: {
            onboardingStep: VimopayOnboardingStep.TWO_FA_PENDING,

            ekycClientRefId: merchantRefId,

            ekycTxnRefId: result.txnRefId,

            ekycCompletedAt: now,

            lastProviderStatusCode: result.status,

            lastProviderStatusMessage: result.statusDescription,
          },
        }),

        this.prisma.aepsMerchantProfile.update({
          where: {
            id: profile.id,
          },

          data: {
            /*
             * Full onboarding abhi complete
             * nahi hai.
             */
            onboardingCompleted: false,

            serviceActivated: false,

            status: AepsMerchantStatus.ACTION_REQUIRED,

            statusReason: 'VimoPay 2FA required',
          },
        }),
      ]);

      return {
        provider: this.provider,

        skipped: false,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: AepsMerchantStatus.ACTION_REQUIRED,

        onboardingStep: VimopayOnboardingStep.TWO_FA_PENDING,

        merchantRefId,

        txnRefId: result.txnRefId,

        message: result.statusDescription,

        nextAction: 'TWO_FACTOR_AUTH',
      };
    } catch (error: unknown) {
      /*
       * Biometric/E-KYC failure ko
       * merchant-wide REJECTED nahi karenge.
       *
       * User retry kar sakta hai.
       */
      await this.recordStepError(profile.id, error);

      throw error;
    }
  }

  /*
   * =====================================================
   * 2 FACTOR AUTHENTICATION
   * =====================================================
   */

  private isSameVimopayDay(first: Date, second: Date): boolean {
    /*
     * VimoPay Indian AEPS provider hai.
     *
     * Deployment server UTC ho sakta hai,
     * isliye server local timezone par
     * depend nahi karenge.
     *
     * Docs sirf "once in a day" bolti hain;
     * application-level day boundary
     * Asia/Kolkata use kar rahe hain.
     */

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',

      year: 'numeric',

      month: '2-digit',

      day: '2-digit',
    });

    return formatter.format(first) === formatter.format(second);
  }

  async completeTwoFactorAuth(identityId: string, dto: VimopayTwoFactorDto) {
    const { profile, detail, merchantId } =
      await this.getRegisteredMerchantState(identityId);

    /*
     * E-KYC pehle complete honi mandatory hai.
     */
    if (!detail.ekycCompletedAt) {
      throw new BadRequestException(
        'VimoPay merchant E-KYC must be completed before 2FA',
      );
    }

    /*
     * VimoPay docs:
     * merchant ko 2FA once in a day karna hai.
     *
     * Same day already successful hai to
     * provider ko duplicate biometric request
     * nahi bhejenge.
     */
    if (
      detail.lastTwoFactorAuthAt &&
      this.isSameVimopayDay(detail.lastTwoFactorAuthAt, new Date())
    ) {
      return {
        provider: this.provider,

        skipped: true,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: profile.status,

        onboardingStep: detail.onboardingStep,

        lastTwoFactorAuthAt: detail.lastTwoFactorAuthAt,

        message: 'VimoPay 2FA is already completed for today',
      };
    }

    /*
     * First onboarding:
     * TWO_FA_PENDING
     *
     * Next day:
     * ACTIVE merchant ko daily 2FA dobara
     * karne denge.
     */
    const allowedSteps: VimopayOnboardingStep[] = [
      VimopayOnboardingStep.TWO_FA_PENDING,

      VimopayOnboardingStep.ACTIVE,
    ];

    if (!allowedSteps.includes(detail.onboardingStep)) {
      throw new BadRequestException(
        `VimoPay 2FA is not allowed in ${detail.onboardingStep} state`,
      );
    }

    const merchantRefId = this.generateMerchantRefId('2FA');

    try {
      const result = await this.vimopayService.twoFactorAuth({
        merchantId,

        merchantRefId,

        /*
         * User/frontend se fresh input.
         */
        aadhaarNumber: dto.aadhaarNumber,

        deviceType: dto.deviceType,

        pidData: dto.pidData,

        lat: dto.lat,

        long: dto.long,
      });

      const now = new Date();

      /*
       * Provider 2FA successful.
       *
       * Provider detail + common profile
       * SAME DB transaction mein update karenge.
       */
      await this.prisma.$transaction([
        this.prisma.vimopayMerchantDetail.update({
          where: {
            profileId: profile.id,
          },

          data: {
            onboardingStep: VimopayOnboardingStep.ACTIVE,

            lastTwoFactorClientRefId: merchantRefId,

            lastTwoFactorTxnRefId: result.txnRefId,

            lastTwoFactorAuthAt: now,

            lastProviderStatusCode: result.status,

            lastProviderStatusMessage: result.statusDescription,
          },
        }),

        this.prisma.aepsMerchantProfile.update({
          where: {
            id: profile.id,
          },

          data: {
            status: AepsMerchantStatus.ACTIVE,

            providerRegistrationCompleted: true,

            onboardingCompleted: true,

            serviceActivated: true,

            /*
             * First onboarding date preserve.
             */
            onboardedAt: profile.onboardedAt ?? now,

            /*
             * First activation date preserve.
             *
             * Daily 2FA isko overwrite nahi karegi.
             */
            activatedAt: profile.activatedAt ?? now,

            statusReason: null,
          },
        }),
      ]);

      return {
        provider: this.provider,

        skipped: false,

        profileId: profile.id,

        providerMerchantId: merchantId,

        status: AepsMerchantStatus.ACTIVE,

        onboardingStep: VimopayOnboardingStep.ACTIVE,

        merchantRefId,

        txnRefId: result.txnRefId,

        lastTwoFactorAuthAt: now,

        message: result.statusDescription,

        nextAction: 'AEPS_TRANSACTION',
      };
    } catch (error: unknown) {
      /*
       * Failed biometric ko merchant-wide
       * REJECTED nahi maanenge.
       *
       * User fresh PID ke saath retry karega.
       */
      await this.recordStepError(profile.id, error);

      throw error;
    }
  }

  /*
   * =====================================================
   * INTERNAL STATE
   * =====================================================
   */

  private async getRegisteredMerchantState(identityId: string) {
    const profile = await this.profileService.getProfileOrThrow(
      identityId,
      this.provider,
    );

    if (
      profile.status === AepsMerchantStatus.BLOCKED ||
      profile.status === AepsMerchantStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        `VimoPay AEPS profile is ${profile.status.toLowerCase()}`,
      );
    }

    if (!profile.providerRegistrationCompleted || !profile.providerMerchantId) {
      throw new BadRequestException(
        'VimoPay merchant registration must be completed first',
      );
    }

    const detail = await this.prisma.vimopayMerchantDetail.findUnique({
      where: {
        profileId: profile.id,
      },
    });

    if (!detail) {
      throw new InternalServerErrorException(
        'VimoPay merchant onboarding details are missing',
      );
    }

    return {
      profile,

      detail,

      merchantId: profile.providerMerchantId,
    };
  }

  /*
   * =====================================================
   * OTP STATE RULES
   * =====================================================
   */

  private assertOtpPending(step: VimopayOnboardingStep) {
    if (step !== VimopayOnboardingStep.OTP_PENDING) {
      throw new BadRequestException(
        `VimoPay OTP action is not allowed in ${step} state`,
      );
    }
  }

  private isOtpCompleted(detail: {
    onboardingStep: VimopayOnboardingStep;
    otpVerifiedAt: Date | null;
  }): boolean {
    if (detail.otpVerifiedAt) {
      return true;
    }

    const otpCompletedSteps: VimopayOnboardingStep[] = [
      VimopayOnboardingStep.OTP_VERIFIED,
      VimopayOnboardingStep.EKYC_PENDING,
      VimopayOnboardingStep.EKYC_COMPLETED,
      VimopayOnboardingStep.TWO_FA_PENDING,
      VimopayOnboardingStep.ACTIVE,
    ];

    return otpCompletedSteps.includes(detail.onboardingStep);
  }

  /*
   * =====================================================
   * PROVIDER STEP ERROR
   * =====================================================
   */

  private async recordStepError(profileId: string, error: unknown) {
    const message = this.extractErrorMessage(error);

    const providerStatusCode = this.extractProviderStatusCode(error);

    try {
      await this.prisma.vimopayMerchantDetail.update({
        where: {
          profileId,
        },

        data: {
          lastProviderStatusCode: providerStatusCode,

          lastProviderStatusMessage: message.slice(0, 500),
        },
      });
    } catch (persistenceError: unknown) {
      this.logger.error(
        'Unable to save VimoPay onboarding step error',
        persistenceError instanceof Error ? persistenceError.stack : undefined,
      );
    }
  }

  /*
   * =====================================================
   * REGISTRATION FAILURE
   * =====================================================
   */

  private async updateFailureDetail(
    profileId: string,
    onboardingStep: VimopayOnboardingStep,
    message: string,
  ) {
    try {
      await this.prisma.vimopayMerchantDetail.update({
        where: {
          profileId,
        },

        data: {
          onboardingStep,

          lastProviderStatusMessage: message.slice(0, 500),
        },
      });
    } catch (error) {
      this.logger.error(
        'Unable to update VimoPay failure state',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /*
   * =====================================================
   * COMMON HELPERS
   * =====================================================
   */

  private getPipe(): string {
    return this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';
  }

  private generateMerchantRefId(operation: string): string {
    return `VMP${operation}${Date.now()}${randomInt(100000, 1000000)}`;
  }

  private extractProviderStatusCode(error: unknown): string | null {
    if (!(error instanceof HttpException)) {
      return null;
    }

    const response = error.getResponse();

    if (!response || typeof response !== 'object') {
      return null;
    }

    const payload = response as Record<string, unknown>;

    const providerStatus = payload.providerStatus;

    if (providerStatus !== undefined && providerStatus !== null) {
      return String(providerStatus);
    }

    const responseCode = payload.responseCode;

    if (responseCode !== undefined && responseCode !== null) {
      return String(responseCode);
    }

    return null;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (response && typeof response === 'object') {
        const payload = response as Record<string, unknown>;

        const message = payload.message;

        if (typeof message === 'string') {
          return message;
        }

        if (Array.isArray(message)) {
          return message.map(String).join(', ');
        }
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'VimoPay onboarding request failed';
  }

  /*
   * =====================================================
   * ONBOARDING STATUS
   * =====================================================
   */

  async getStatus(identityId: string) {
    const profile = await this.profileService.findProfile(
      identityId,
      this.provider,
    );

    /*
     * User ne VimoPay onboarding
     * start hi nahi ki.
     */
    if (!profile) {
      return {
        provider: this.provider,

        status: AepsMerchantStatus.NOT_STARTED,

        onboardingStep: VimopayOnboardingStep.NOT_STARTED,

        serviceActivated: false,

        nextAction: 'REGISTER',
      };
    }

    const detail = await this.prisma.vimopayMerchantDetail.findUnique({
      where: {
        profileId: profile.id,
      },
    });

    /*
     * Blocked/suspended first.
     */
    if (
      profile.status === AepsMerchantStatus.BLOCKED ||
      profile.status === AepsMerchantStatus.SUSPENDED
    ) {
      return {
        provider: this.provider,

        profileId: profile.id,

        status: profile.status,

        onboardingStep:
          detail?.onboardingStep ?? VimopayOnboardingStep.NOT_STARTED,

        serviceActivated: false,

        nextAction: 'CONTACT_SUPPORT',

        reason: profile.statusReason,
      };
    }

    /*
     * Provider detail somehow missing.
     */
    if (!detail) {
      return {
        provider: this.provider,

        profileId: profile.id,

        status: profile.status,

        onboardingStep: null,

        serviceActivated: profile.serviceActivated,

        nextAction: profile.providerRegistrationCompleted
          ? 'CONTACT_SUPPORT'
          : 'REGISTER',
      };
    }

    let nextAction = 'REGISTER';

    switch (detail.onboardingStep) {
      case VimopayOnboardingStep.REGISTRATION_PENDING:
        nextAction = 'WAIT';

        break;

      case VimopayOnboardingStep.OTP_PENDING:
        nextAction = 'OTP';

        break;

      case VimopayOnboardingStep.OTP_VERIFIED:
      case VimopayOnboardingStep.EKYC_PENDING:
        nextAction = 'EKYC';

        break;

      case VimopayOnboardingStep.EKYC_COMPLETED:
      case VimopayOnboardingStep.TWO_FA_PENDING:
        nextAction = 'TWO_FACTOR_AUTH';

        break;

      case VimopayOnboardingStep.ACTIVE:
        /*
         * Merchant ACTIVE hai,
         * but VimoPay daily 2FA required hai.
         */
        if (
          !detail.lastTwoFactorAuthAt ||
          !this.isSameVimopayDay(detail.lastTwoFactorAuthAt, new Date())
        ) {
          nextAction = 'TWO_FACTOR_AUTH';
        } else {
          nextAction = 'AEPS_TRANSACTION';
        }

        break;

      case VimopayOnboardingStep.REJECTED:
        nextAction = 'RETRY_REGISTRATION';

        break;

      case VimopayOnboardingStep.FAILED:
        nextAction = 'RETRY_REGISTRATION';

        break;

      default:
        nextAction = 'REGISTER';
    }

    return {
      provider: this.provider,

      profileId: profile.id,

      providerMerchantId: profile.providerMerchantId,

      status: profile.status,

      onboardingStep: detail.onboardingStep,

      providerRegistrationCompleted: profile.providerRegistrationCompleted,

      onboardingCompleted: profile.onboardingCompleted,

      serviceActivated: profile.serviceActivated,

      lastTwoFactorAuthAt: detail.lastTwoFactorAuthAt,

      nextAction,

      reason: profile.statusReason,
    };
  }
}
