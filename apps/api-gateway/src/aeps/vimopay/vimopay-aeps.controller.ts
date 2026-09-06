import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth-guard';

import { CurrentUser } from '../../auth/decorator/current-user.decorator';

import { JwtPayload } from '../../auth/intercaces/jwt-payload.interface';

import { RpcToHttpExceptionInterceptor } from '../../common/interceptors/rpc-to-http-exception';

import { VimopayAepsService } from './vimopay-aeps.service';

import { PermissionGuard } from '../../auth/guards/permission.guard';

import { RequirePermissions } from '../../auth/decorator/require-permissions.decorator';

import { TRANSACTION_PERMISSIONS } from '@nexus/common/transaction/transaction.permissions';

import { VimopayProviderIncomeGatewayDto } from './dto/vimopay-provider-income-gateway.dto';

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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('AEPS - Vimopay')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Access token is missing, invalid, expired, or the session is invalid',
})
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
  @ApiOperation({
    summary: 'Get Vimopay supported banks',
  })
  @ApiOkResponse({
    description: 'Supported bank list retrieved successfully',
  })
  getBanks() {
    return this.service.getBanks();
  }

  @Get('states')
  @ApiOperation({
    summary: 'Get Vimopay supported states',
  })
  @ApiOkResponse({
    description: 'Supported state list retrieved successfully',
  })
  getStates() {
    return this.service.getStates();
  }

  @Get('districts')
  @ApiOperation({
    summary: 'Get districts for a state',
    description:
      'Returns Vimopay-supported districts based on the supplied query parameters.',
  })
  @ApiOkResponse({
    description: 'District list retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid district query parameters',
  })
  getDistricts(
    @Query()
    query: VimopayDistrictQueryDto,
  ) {
    return this.service.getDistricts(query);
  }

  @Get('bank-iins')
  @ApiOperation({
    summary: 'Get AEPS bank IIN list',
    description:
      'Returns bank IIN information supported by the Vimopay AEPS provider.',
  })
  @ApiOkResponse({
    description: 'Bank IIN list retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid bank-IIN query parameters',
  })
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
  @ApiOperation({
    summary: 'Get my Vimopay AEPS onboarding status',
  })
  @ApiOkResponse({
    description: 'AEPS status retrieved successfully',
  })
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
  @ApiOperation({
    summary: 'Register merchant with Vimopay AEPS',
    description:
      'Starts or continues Vimopay AEPS merchant onboarding for the authenticated identity.',
  })
  @ApiCreatedResponse({
    description: 'Vimopay merchant registration request completed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid onboarding registration payload',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated identity is not eligible for AEPS onboarding',
  })
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
  @ApiOperation({
    summary: 'Send Vimopay onboarding OTP',
  })
  @ApiCreatedResponse({
    description: 'Onboarding OTP sent successfully',
  })
  @ApiBadRequestResponse({
    description: 'OTP cannot be sent at the current onboarding stage',
  })
  @ApiTooManyRequestsResponse({
    description: 'OTP resend cooldown or request limit exceeded',
  })
  sendOtp(
    @CurrentUser()
    user: JwtPayload,
  ) {
    return this.service.sendOtp(user.sub);
  }

  @Post('onboarding/otp/resend')
  @ApiOperation({
    summary: 'Resend Vimopay onboarding OTP',
  })
  @ApiCreatedResponse({
    description: 'Onboarding OTP resent successfully',
  })
  @ApiBadRequestResponse({
    description: 'OTP cannot be resent at the current onboarding stage',
  })
  @ApiTooManyRequestsResponse({
    description: 'OTP resend cooldown or request limit exceeded',
  })
  resendOtp(
    @CurrentUser()
    user: JwtPayload,
  ) {
    return this.service.resendOtp(user.sub);
  }

  @Post('onboarding/otp/verify')
  @ApiOperation({
    summary: 'Verify Vimopay onboarding OTP',
  })
  @ApiCreatedResponse({
    description: 'Onboarding OTP verified successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired OTP',
  })
  @ApiTooManyRequestsResponse({
    description: 'Maximum OTP verification attempts exceeded',
  })
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
  @ApiOperation({
    summary: 'Complete Vimopay AEPS e-KYC',
  })
  @ApiCreatedResponse({
    description: 'AEPS e-KYC request completed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid e-KYC request payload',
  })
  @ApiForbiddenResponse({
    description: 'e-KYC is not available at the current onboarding stage',
  })
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
  @ApiOperation({
    summary: 'Complete Vimopay daily two-factor authentication',
  })
  @ApiCreatedResponse({
    description: 'Daily AEPS 2FA completed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid two-factor authentication payload',
  })
  @ApiForbiddenResponse({
    description:
      'Two-factor authentication is not available for the current account state',
  })
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
  @ApiOperation({
    summary: 'Perform AEPS balance enquiry',
  })
  @ApiCreatedResponse({
    description: 'Balance enquiry completed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid balance-enquiry request',
  })
  @ApiForbiddenResponse({
    description:
      'AEPS transaction is not permitted for the current account or onboarding state',
  })
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
  @ApiOperation({
    summary: 'Get AEPS mini statement',
  })
  @ApiCreatedResponse({
    description: 'Mini statement retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid mini-statement request',
  })
  @ApiForbiddenResponse({
    description:
      'AEPS transaction is not permitted for the current account or onboarding state',
  })
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
  @ApiOperation({
    summary: 'Generate OTP for AEPS cash withdrawal',
  })
  @ApiCreatedResponse({
    description: 'Cash-withdrawal OTP generated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid cash-withdrawal OTP request',
  })
  @ApiTooManyRequestsResponse({
    description: 'OTP request limit exceeded',
  })
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
  @ApiOperation({
    summary: 'Perform AEPS cash withdrawal',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description:
      'Unique UUID used to prevent duplicate cash-withdrawal transactions',
    schema: {
      type: 'string',
      format: 'uuid',
    },
  })
  @ApiCreatedResponse({
    description: 'Cash withdrawal processed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction payload or Idempotency-Key header',
  })
  @ApiForbiddenResponse({
    description:
      'Cash withdrawal is not permitted for the current account state',
  })
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
  @ApiOperation({
    summary: 'Generate OTP for AEPS Aadhaar Pay',
  })
  @ApiCreatedResponse({
    description: 'Aadhaar Pay OTP generated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid Aadhaar Pay OTP request',
  })
  @ApiTooManyRequestsResponse({
    description: 'OTP request limit exceeded',
  })
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
  @ApiOperation({
    summary: 'Perform AEPS Aadhaar Pay transaction',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description:
      'Unique UUID used to prevent duplicate Aadhaar Pay transactions',
    schema: {
      type: 'string',
      format: 'uuid',
    },
  })
  @ApiCreatedResponse({
    description: 'Aadhaar Pay transaction processed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction payload or Idempotency-Key header',
  })
  @ApiForbiddenResponse({
    description: 'Aadhaar Pay is not permitted for the current account state',
  })
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
  @ApiOperation({
    summary: 'Perform AEPS cash deposit',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description:
      'Unique UUID used to prevent duplicate cash-deposit transactions',
    schema: {
      type: 'string',
      format: 'uuid',
    },
  })
  @ApiCreatedResponse({
    description: 'Cash deposit processed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction payload or Idempotency-Key header',
  })
  @ApiForbiddenResponse({
    description: 'Cash deposit is not permitted for the current account state',
  })
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

  @Post('admin/provider-income/:referenceId/reconcile')
  // @UseGuards(PermissionGuard)
  // @RequirePermissions(TRANSACTION_PERMISSIONS.RECONCILIATION_RESOLVE)
  @ApiOperation({
    summary: 'Reconcile Vimopay provider income',
    description:
      'Manually reconciles provider-income information for an AEPS transaction reference.',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'Transaction or provider-income reference ID',
  })
  @ApiCreatedResponse({
    description: 'Provider income reconciled successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid reconciliation request or reference ID',
  })
  @ApiNotFoundResponse({
    description: 'Provider income or transaction reference not found',
  })
  @ApiForbiddenResponse({
    description:
      'Authenticated account is not authorized to reconcile provider income',
  })
  reconcileProviderIncome(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,

    @Body()
    dto: VimopayProviderIncomeGatewayDto,
  ) {
    return this.service.reconcileProviderIncome({
      referenceId,

      reconciledBy: user.sub,

      ...dto,
    });
  }
}
