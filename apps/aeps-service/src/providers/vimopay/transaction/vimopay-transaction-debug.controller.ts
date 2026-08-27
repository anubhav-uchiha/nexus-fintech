import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Ip,
  NotFoundException,
  Post,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { isUUID } from 'class-validator';

import { VimopayTransactionService } from './vimopay-transaction.service';

import { VimopayBalanceEnquiryRequestDto } from './dto/vimopay-balance-enquiry-request.dto';
import { VimopayMiniStatementRequestDto } from './dto/vimopay-mini-statement-request.dto';
import { VimopayCashWithdrawalRequestDto } from './dto/vimopay-cash-withdrawal-request.dto';
import { VimopayCashWithdrawalOtpRequestDto } from './dto/vimopay-cw-otp-request.dto';
import { VimopayAadhaarPayOtpRequestDto } from './dto/vimopay-ap-otp-request.dto';
import { VimopayAadhaarPayRequestDto } from './dto/vimopay-aadhaar-pay-request.dto';
import { VimopayCashDepositRequestDto } from './dto/vimopay-cash-deposit-request.dto';

@Controller('_debug/vimopay/transaction')
export class VimopayTransactionDebugController {
  constructor(
    private readonly transactionService: VimopayTransactionService,

    private readonly configService: ConfigService,
  ) {}

  /*
   * ==========================================
   * BALANCE ENQUIRY
   * ==========================================
   */

  @Post('balance-enquiry')
  balanceEnquiry(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayBalanceEnquiryRequestDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.transactionService.balanceEnquiry(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,
    );
  }

  private validateIdentityId(identityId: string) {
    if (!identityId) {
      throw new BadRequestException('x-debug-identity-id header is required');
    }

    if (!isUUID(identityId)) {
      throw new BadRequestException('x-debug-identity-id must be a valid UUID');
    }
  }

  private normalizeIpAddress(ipAddress: string): string {
    const normalized = ipAddress.trim();

    if (normalized === '::1') {
      return '127.0.0.1';
    }

    if (normalized.startsWith('::ffff:')) {
      return normalized.slice('::ffff:'.length);
    }

    return normalized;
  }

  private ensureDebugAllowed() {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv === 'production') {
      throw new NotFoundException();
    }
  }

  /*
   * ==========================================
   * MINI STATEMENT
   * ==========================================
   */

  @Post('mini-statement')
  miniStatement(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayMiniStatementRequestDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.transactionService.miniStatement(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,
    );
  }

  /*
   * ==========================================
   * CASH WITHDRAWAL
   * ==========================================
   */

  @Post('cash-withdrawal')
  cashWithdrawal(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Headers('idempotency-key')
    idempotencyKey: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayCashWithdrawalRequestDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    this.validateIdempotencyKey(idempotencyKey);

    return this.transactionService.cashWithdrawal(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,

      idempotencyKey,
    );
  }

  @Post('cash-withdrawal/otp')
  sendCashWithdrawalOtp(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayCashWithdrawalOtpRequestDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.transactionService.sendCashWithdrawalOtp(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,
    );
  }

  @Post('aadhaar-pay/otp')
  sendAadhaarPayOtp(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayAadhaarPayOtpRequestDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.transactionService.sendAadhaarPayOtp(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,
    );
  }

  private validateIdempotencyKey(value: string) {
    if (!value) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (!isUUID(value)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }
  }

  @Post('aadhaar-pay')
  aadhaarPay(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Headers('idempotency-key')
    idempotencyKey: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayAadhaarPayRequestDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    this.validateIdempotencyKey(idempotencyKey);

    return this.transactionService.aadhaarPay(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,

      idempotencyKey,
    );
  }

  /*
   * ==========================================
   * CASH DEPOSIT
   * ==========================================
   */

  @Post('cash-deposit')
  cashDeposit(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Headers('idempotency-key')
    idempotencyKey: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayCashDepositRequestDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    this.validateIdempotencyKey(idempotencyKey);

    return this.transactionService.cashDeposit(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,

      idempotencyKey,
    );
  }
}
