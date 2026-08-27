import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { firstValueFrom } from 'rxjs';

import { VIMOPAY_AEPS_PATTERNS } from '@nexus/common/aeps/vimopay/vimopay-aeps.patterns';

import {
  VimopayBankIinQueryDto,
  VimopayDistrictQueryDto,
  VimopayEkycRequestDto,
  VimopayRegisterRequestDto,
  VimopayTwoFactorRequestDto,
  VimopayVerifyOtpRequestDto,
} from './dto/vimopay-gateway.dto';

import {
  VimopayAadhaarPayGatewayDto,
  VimopayAadhaarPayOtpGatewayDto,
  VimopayBalanceEnquiryGatewayDto,
  VimopayCashDepositGatewayDto,
  VimopayCashWithdrawalGatewayDto,
  VimopayCashWithdrawalOtpGatewayDto,
  VimopayMiniStatementGatewayDto,
} from './dto/vimopay-transaction-gateway.dto';

export const AEPS_SERVICE_CLIENT = 'AEPS_SERVICE_CLIENT';

@Injectable()
export class VimopayAepsService implements OnModuleInit {
  constructor(
    @Inject(AEPS_SERVICE_CLIENT)
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    Object.values(VIMOPAY_AEPS_PATTERNS).forEach((pattern) => {
      this.client.subscribeToResponseOf(pattern);
    });

    await this.client.connect();
  }

  /*
   * ==========================================
   * MASTER
   * ==========================================
   */

  getBanks() {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.GET_BANKS, {}),
    );
  }

  getStates() {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.GET_STATES, {}),
    );
  }

  getDistricts(dto: VimopayDistrictQueryDto) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.GET_DISTRICTS, dto),
    );
  }

  getBankIins(dto: VimopayBankIinQueryDto) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.GET_BANK_IINS, dto),
    );
  }

  /*
   * ==========================================
   * STATUS
   * ==========================================
   */

  getStatus(identityId: string) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.GET_STATUS, {
        identityId,
      }),
    );
  }

  /*
   * ==========================================
   * REGISTER
   * ==========================================
   */

  register(
    identityId: string,
    ipAddress: string,
    dto: VimopayRegisterRequestDto,
  ) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.REGISTER, {
        identityId,

        ipAddress,

        dto,
      }),
    );
  }

  /*
   * ==========================================
   * OTP
   * ==========================================
   */

  sendOtp(identityId: string) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.SEND_OTP, {
        identityId,
      }),
    );
  }

  resendOtp(identityId: string) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.RESEND_OTP, {
        identityId,
      }),
    );
  }

  verifyOtp(identityId: string, dto: VimopayVerifyOtpRequestDto) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.VERIFY_OTP, {
        identityId,

        dto,
      }),
    );
  }

  /*
   * ==========================================
   * E-KYC
   * ==========================================
   */

  ekyc(identityId: string, dto: VimopayEkycRequestDto) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.EKYC, {
        identityId,

        dto,
      }),
    );
  }

  /*
   * ==========================================
   * 2FA
   * ==========================================
   */

  twoFactorAuth(identityId: string, dto: VimopayTwoFactorRequestDto) {
    return firstValueFrom(
      this.client.send(VIMOPAY_AEPS_PATTERNS.TWO_FACTOR_AUTH, {
        identityId,

        dto,
      }),
    );
  }

  /*
   * ==========================================
   * BALANCE ENQUIRY
   * ==========================================
   */

  balanceEnquiry(
    identityId: string,
    ipAddress: string,
    dto: VimopayBalanceEnquiryGatewayDto,
  ) {
    return firstValueFrom(
      this.client.send(
        VIMOPAY_AEPS_PATTERNS.BALANCE_ENQUIRY,

        {
          identityId,
          ipAddress,
          dto,
        },
      ),
    );
  }

  /*
   * ==========================================
   * MINI STATEMENT
   * ==========================================
   */

  miniStatement(
    identityId: string,
    ipAddress: string,
    dto: VimopayMiniStatementGatewayDto,
  ) {
    return firstValueFrom(
      this.client.send(
        VIMOPAY_AEPS_PATTERNS.MINI_STATEMENT,

        {
          identityId,
          ipAddress,
          dto,
        },
      ),
    );
  }

  /*
   * ==========================================
   * CASH WITHDRAWAL OTP
   * ==========================================
   */

  cashWithdrawalOtp(
    identityId: string,
    ipAddress: string,
    dto: VimopayCashWithdrawalOtpGatewayDto,
  ) {
    return firstValueFrom(
      this.client.send(
        VIMOPAY_AEPS_PATTERNS.CASH_WITHDRAWAL_OTP,

        {
          identityId,
          ipAddress,
          dto,
        },
      ),
    );
  }

  /*
   * ==========================================
   * CASH WITHDRAWAL
   * ==========================================
   */

  cashWithdrawal(
    identityId: string,
    ipAddress: string,

    idempotencyKey: string,

    dto: VimopayCashWithdrawalGatewayDto,
  ) {
    return firstValueFrom(
      this.client.send(
        VIMOPAY_AEPS_PATTERNS.CASH_WITHDRAWAL,

        {
          identityId,
          ipAddress,
          idempotencyKey,
          dto,
        },
      ),
    );
  }

  /*
   * ==========================================
   * AADHAAR PAY OTP
   * ==========================================
   */

  aadhaarPayOtp(
    identityId: string,
    ipAddress: string,
    dto: VimopayAadhaarPayOtpGatewayDto,
  ) {
    return firstValueFrom(
      this.client.send(
        VIMOPAY_AEPS_PATTERNS.AADHAAR_PAY_OTP,

        {
          identityId,
          ipAddress,
          dto,
        },
      ),
    );
  }

  /*
   * ==========================================
   * AADHAAR PAY
   * ==========================================
   */

  aadhaarPay(
    identityId: string,
    ipAddress: string,

    idempotencyKey: string,

    dto: VimopayAadhaarPayGatewayDto,
  ) {
    return firstValueFrom(
      this.client.send(
        VIMOPAY_AEPS_PATTERNS.AADHAAR_PAY,

        {
          identityId,
          ipAddress,
          idempotencyKey,
          dto,
        },
      ),
    );
  }

  /*
   * ==========================================
   * CASH DEPOSIT
   * ==========================================
   */

  cashDeposit(
    identityId: string,
    ipAddress: string,

    idempotencyKey: string,

    dto: VimopayCashDepositGatewayDto,
  ) {
    return firstValueFrom(
      this.client.send(
        VIMOPAY_AEPS_PATTERNS.CASH_DEPOSIT,

        {
          identityId,
          ipAddress,
          idempotencyKey,
          dto,
        },
      ),
    );
  }
}
