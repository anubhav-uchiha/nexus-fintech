import { Controller, UseInterceptors } from '@nestjs/common';

import { MessagePattern, Payload } from '@nestjs/microservices';

import { VIMOPAY_AEPS_PATTERNS } from '@nexus/common/aeps/vimopay/vimopay-aeps.patterns';

import { HttpToRpcExceptionInterceptor } from '../../../common/interceptors/http-to-rpc-exception.interceptor';

import { VimopayService } from '../vimopay.service';

import { VimopayOnboardingService } from '../onboarding/vimopay-onboarding.service';

import { VimopayRegisterDto } from '../onboarding/dto/vimopay-register.dto';

import { VimopayVerifyOtpDto } from '../onboarding/dto/vimopay-verify-otp.dto';

import { VimopayEkycDto } from '../onboarding/dto/vimopay-ekyc.dto';

import { VimopayTwoFactorDto } from '../onboarding/dto/vimopay-two-factor.dto';

import { VimopayDistrictRequestDto } from '../dto/district-request.dto';

import { VimopayBankIinRequestDto } from '../dto/bank-iin-request.dto';

import { VimopayTransactionService } from '../transaction/vimopay-transaction.service';

import { VimopayBalanceEnquiryRequestDto } from '../transaction/dto/vimopay-balance-enquiry-request.dto';

import { VimopayMiniStatementRequestDto } from '../transaction/dto/vimopay-mini-statement-request.dto';

import { VimopayCashWithdrawalRequestDto } from '../transaction/dto/vimopay-cash-withdrawal-request.dto';

import { VimopayCashWithdrawalOtpRequestDto } from '../transaction/dto/vimopay-cw-otp-request.dto';

import { VimopayAadhaarPayRequestDto } from '../transaction/dto/vimopay-aadhaar-pay-request.dto';

import { VimopayAadhaarPayOtpRequestDto } from '../transaction/dto/vimopay-ap-otp-request.dto';

import { VimopayCashDepositRequestDto } from '../transaction/dto/vimopay-cash-deposit-request.dto';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class VimopayKafkaController {
  constructor(
    private readonly vimopayService: VimopayService,
    private readonly onboardingService: VimopayOnboardingService,
    private readonly vimopayTransactionService: VimopayTransactionService,
  ) {}

  /*
   * ==========================================
   * MASTER DATA
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.GET_BANKS)
  getBanks() {
    return this.vimopayService.getBankList();
  }

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.GET_STATES)
  getStates() {
    return this.vimopayService.getStateList();
  }

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.GET_DISTRICTS)
  getDistricts(
    @Payload()
    dto: VimopayDistrictRequestDto,
  ) {
    return this.vimopayService.getDistrictList(dto);
  }

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.GET_BANK_IINS)
  getBankIins(
    @Payload()
    dto: VimopayBankIinRequestDto,
  ) {
    return this.vimopayService.getBankIinList(dto);
  }

  /*
   * ==========================================
   * STATUS
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.GET_STATUS)
  getStatus(
    @Payload()
    payload: {
      identityId: string;
    },
  ) {
    return this.onboardingService.getStatus(payload.identityId);
  }

  /*
   * ==========================================
   * REGISTER
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.REGISTER)
  register(
    @Payload()
    payload: {
      identityId: string;

      ipAddress: string;

      dto: VimopayRegisterDto;
    },
  ) {
    return this.onboardingService.register(
      {
        identityId: payload.identityId,

        ipAddress: payload.ipAddress,
      },

      payload.dto,
    );
  }

  /*
   * ==========================================
   * SEND OTP
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.SEND_OTP)
  sendOtp(
    @Payload()
    payload: {
      identityId: string;
    },
  ) {
    return this.onboardingService.sendOtp(payload.identityId);
  }

  /*
   * ==========================================
   * RESEND OTP
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.RESEND_OTP)
  resendOtp(
    @Payload()
    payload: {
      identityId: string;
    },
  ) {
    return this.onboardingService.resendOtp(payload.identityId);
  }

  /*
   * ==========================================
   * VERIFY OTP
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.VERIFY_OTP)
  verifyOtp(
    @Payload()
    payload: {
      identityId: string;

      dto: VimopayVerifyOtpDto;
    },
  ) {
    return this.onboardingService.verifyOtp(payload.identityId, payload.dto);
  }

  /*
   * ==========================================
   * E-KYC
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.EKYC)
  ekyc(
    @Payload()
    payload: {
      identityId: string;

      dto: VimopayEkycDto;
    },
  ) {
    return this.onboardingService.completeEkyc(payload.identityId, payload.dto);
  }

  /*
   * ==========================================
   * 2FA
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.TWO_FACTOR_AUTH)
  twoFactorAuth(
    @Payload()
    payload: {
      identityId: string;

      dto: VimopayTwoFactorDto;
    },
  ) {
    return this.onboardingService.completeTwoFactorAuth(
      payload.identityId,
      payload.dto,
    );
  }

  /*
   * ==========================================
   * BALANCE ENQUIRY
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.BALANCE_ENQUIRY)
  balanceEnquiry(
    @Payload()
    payload: {
      identityId: string;
      ipAddress: string;
      dto: VimopayBalanceEnquiryRequestDto;
    },
  ) {
    return this.vimopayTransactionService.balanceEnquiry(
      {
        identityId: payload.identityId,

        ipAddress: payload.ipAddress,
      },

      payload.dto,
    );
  }

  /*
   * ==========================================
   * MINI STATEMENT
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.MINI_STATEMENT)
  miniStatement(
    @Payload()
    payload: {
      identityId: string;
      ipAddress: string;
      dto: VimopayMiniStatementRequestDto;
    },
  ) {
    return this.vimopayTransactionService.miniStatement(
      {
        identityId: payload.identityId,

        ipAddress: payload.ipAddress,
      },

      payload.dto,
    );
  }

  /*
   * ==========================================
   * CASH WITHDRAWAL TRANSACTION OTP
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.CASH_WITHDRAWAL_OTP)
  cashWithdrawalOtp(
    @Payload()
    payload: {
      identityId: string;
      ipAddress: string;
      dto: VimopayCashWithdrawalOtpRequestDto;
    },
  ) {
    return this.vimopayTransactionService.sendCashWithdrawalOtp(
      {
        identityId: payload.identityId,

        ipAddress: payload.ipAddress,
      },

      payload.dto,
    );
  }

  /*
   * ==========================================
   * CASH WITHDRAWAL
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.CASH_WITHDRAWAL)
  async cashWithdrawal(
    @Payload()
    payload: {
      identityId: string;
      role: string;
      ipAddress: string;
      idempotencyKey: string;
      dto: VimopayCashWithdrawalRequestDto;
    },
  ) {
    return this.vimopayTransactionService.cashWithdrawal(
      {
        identityId: payload.identityId,

        role: payload.role,

        ipAddress: payload.ipAddress,
      },
      payload.dto,
      payload.idempotencyKey,
    );
  }

  /*
   * ==========================================
   * AADHAAR PAY TRANSACTION OTP
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.AADHAAR_PAY_OTP)
  aadhaarPayOtp(
    @Payload()
    payload: {
      identityId: string;
      ipAddress: string;
      dto: VimopayAadhaarPayOtpRequestDto;
    },
  ) {
    return this.vimopayTransactionService.sendAadhaarPayOtp(
      {
        identityId: payload.identityId,

        ipAddress: payload.ipAddress,
      },

      payload.dto,
    );
  }

  /*
   * ==========================================
   * AADHAAR PAY
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.AADHAAR_PAY)
  aadhaarPay(
    @Payload()
    payload: {
      identityId: string;
      ipAddress: string;
      role: string;
      idempotencyKey: string;

      dto: VimopayAadhaarPayRequestDto;
    },
  ) {
    return this.vimopayTransactionService.aadhaarPay(
      {
        identityId: payload.identityId,

        ipAddress: payload.ipAddress,
        role: payload.role,
      },

      payload.dto,

      payload.idempotencyKey,
    );
  }

  /*
   * ==========================================
   * CASH DEPOSIT
   * ==========================================
   */

  @MessagePattern(VIMOPAY_AEPS_PATTERNS.CASH_DEPOSIT)
  cashDeposit(
    @Payload()
    payload: {
      identityId: string;
      ipAddress: string;
      role: string;
      idempotencyKey: string;

      dto: VimopayCashDepositRequestDto;
    },
  ) {
    return this.vimopayTransactionService.cashDeposit(
      {
        identityId: payload.identityId,

        ipAddress: payload.ipAddress,
        role: payload.role,
      },

      payload.dto,

      payload.idempotencyKey,
    );
  }
}
