import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth-guard';

import { CurrentUser } from '../../auth/decorator/current-user.decorator';

import { JwtPayload } from '../../auth/intercaces/jwt-payload.interface';

import { RpcToHttpExceptionInterceptor } from '../../common/interceptors/rpc-to-http-exception';

import { VimopayAepsService } from './vimopay-aeps.service';

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

@Controller('aeps/vimopay')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class VimopayAepsController {
  constructor(private readonly service: VimopayAepsService) {}

  /*
   * ==========================================
   * MASTER
   * ==========================================
   */

  @Get('banks')
  getBanks() {
    return this.service.getBanks();
  }

  @Get('states')
  getStates() {
    return this.service.getStates();
  }

  @Get('districts')
  getDistricts(
    @Query()
    query: VimopayDistrictQueryDto,
  ) {
    return this.service.getDistricts(query);
  }

  @Get('bank-iins')
  getBankIins(
    @Query()
    query: VimopayBankIinQueryDto,
  ) {
    return this.service.getBankIins(query);
  }

  /*
   * ==========================================
   * STATUS
   * ==========================================
   */

  @Get('status')
  getStatus(
    @CurrentUser()
    user: JwtPayload,
  ) {
    return this.service.getStatus(user.sub);
  }

  /*
   * ==========================================
   * REGISTER
   * ==========================================
   */

  @Post('onboarding/register')
  register(
    @CurrentUser()
    user: JwtPayload,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayRegisterRequestDto,
  ) {
    return this.service.register(
      user.sub,

      this.normalizeIpAddress(requestIp),

      dto,
    );
  }

  /*
   * ==========================================
   * OTP
   * ==========================================
   */

  @Post('onboarding/otp/send')
  sendOtp(
    @CurrentUser()
    user: JwtPayload,
  ) {
    return this.service.sendOtp(user.sub);
  }

  @Post('onboarding/otp/resend')
  resendOtp(
    @CurrentUser()
    user: JwtPayload,
  ) {
    return this.service.resendOtp(user.sub);
  }

  @Post('onboarding/otp/verify')
  verifyOtp(
    @CurrentUser()
    user: JwtPayload,

    @Body()
    dto: VimopayVerifyOtpRequestDto,
  ) {
    return this.service.verifyOtp(user.sub, dto);
  }

  /*
   * ==========================================
   * E-KYC
   * ==========================================
   */

  @Post('onboarding/ekyc')
  ekyc(
    @CurrentUser()
    user: JwtPayload,

    @Body()
    dto: VimopayEkycRequestDto,
  ) {
    return this.service.ekyc(user.sub, dto);
  }

  /*
   * ==========================================
   * DAILY 2FA
   * ==========================================
   */

  @Post('onboarding/2fa')
  twoFactorAuth(
    @CurrentUser()
    user: JwtPayload,

    @Body()
    dto: VimopayTwoFactorRequestDto,
  ) {
    return this.service.twoFactorAuth(user.sub, dto);
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

  @Post('balance-enquiry')
  balanceEnquiry(
    @CurrentUser()
    user: JwtPayload,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayBalanceEnquiryGatewayDto,
  ) {
    return this.service.balanceEnquiry(
      user.sub,

      this.normalizeIpAddress(requestIp),

      dto,
    );
  }

  @Post('mini-statement')
  miniStatement(
    @CurrentUser()
    user: JwtPayload,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayMiniStatementGatewayDto,
  ) {
    return this.service.miniStatement(
      user.sub,

      this.normalizeIpAddress(requestIp),

      dto,
    );
  }

  @Post('cash-withdrawal/otp')
  cashWithdrawalOtp(
    @CurrentUser()
    user: JwtPayload,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayCashWithdrawalOtpGatewayDto,
  ) {
    return this.service.cashWithdrawalOtp(
      user.sub,

      this.normalizeIpAddress(requestIp),

      dto,
    );
  }

  @Post('cash-withdrawal')
  cashWithdrawal(
    @CurrentUser()
    user: JwtPayload,

    @Headers('idempotency-key')
    idempotencyKey: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayCashWithdrawalGatewayDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);

    return this.service.cashWithdrawal({
      identityId: user.sub,
      role: user.role,
      ipAddress: this.normalizeIpAddress(requestIp),
      idempotencyKey,
      dto,
    });
  }

  @Post('aadhaar-pay/otp')
  aadhaarPayOtp(
    @CurrentUser()
    user: JwtPayload,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayAadhaarPayOtpGatewayDto,
  ) {
    return this.service.aadhaarPayOtp(
      user.sub,

      this.normalizeIpAddress(requestIp),

      dto,
    );
  }

  @Post('aadhaar-pay')
  aadhaarPay(
    @CurrentUser()
    user: JwtPayload,

    @Headers('idempotency-key')
    idempotencyKey: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayAadhaarPayGatewayDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);

    return this.service.aadhaarPay({
      identityId: user.sub,
      role: user.role,
      ipAddress: this.normalizeIpAddress(requestIp),
      idempotencyKey,
      dto,
    });
  }

  @Post('cash-deposit')
  cashDeposit(
    @CurrentUser()
    user: JwtPayload,

    @Headers('idempotency-key')
    idempotencyKey: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayCashDepositGatewayDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);

    return this.service.cashDeposit({
      identityId: user.sub,
      role: user.role,
      ipAddress: this.normalizeIpAddress(requestIp),
      idempotencyKey,
      dto,
    });
  }

  private validateIdempotencyKey(value: string) {
    if (!value) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (!isUUID(value)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }
  }
}
