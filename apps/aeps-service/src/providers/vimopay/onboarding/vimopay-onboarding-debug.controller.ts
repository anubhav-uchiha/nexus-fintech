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

import { VimopayOnboardingService } from './vimopay-onboarding.service';

import { VimopayRegisterDto } from './dto/vimopay-register.dto';

import { VimopayVerifyOtpDto } from './dto/vimopay-verify-otp.dto';
import { VimopayEkycDto } from './dto/vimopay-ekyc.dto';
import {
  VimopayTwoFactorDto,
} from './dto/vimopay-two-factor.dto';

@Controller('_debug/vimopay/onboarding')
export class VimopayOnboardingDebugController {
  constructor(
    private readonly onboardingService: VimopayOnboardingService,

    private readonly configService: ConfigService,
  ) {}

  /*
   * ==========================================
   * REGISTER
   * ==========================================
   */

  @Post('register')
  register(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Ip()
    requestIp: string,

    @Body()
    dto: VimopayRegisterDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.onboardingService.register(
      {
        identityId,

        ipAddress: this.normalizeIpAddress(requestIp),
      },

      dto,
    );
  }

  /*
   * ==========================================
   * SEND OTP
   * ==========================================
   */

  @Post('otp/send')
  sendOtp(
    @Headers('x-debug-identity-id')
    identityId: string,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.onboardingService.sendOtp(identityId);
  }

  /*
   * ==========================================
   * RESEND OTP
   * ==========================================
   */

  @Post('otp/resend')
  resendOtp(
    @Headers('x-debug-identity-id')
    identityId: string,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.onboardingService.resendOtp(identityId);
  }

  /*
   * ==========================================
   * VERIFY OTP
   * ==========================================
   */

  @Post('otp/verify')
  verifyOtp(
    @Headers('x-debug-identity-id')
    identityId: string,

    @Body()
    dto: VimopayVerifyOtpDto,
  ) {
    this.ensureDebugAllowed();

    this.validateIdentityId(identityId);

    return this.onboardingService.verifyOtp(identityId, dto);
  }

  /*
   * ==========================================
   * HELPERS
   * ==========================================
   */

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
  @Post('ekyc')
  completeEkyc(
    @Headers('x-debug-identity-id')
    identityId: string,
    @Body()
    dto: VimopayEkycDto,
  ) {
    this.ensureDebugAllowed();
    this.validateIdentityId(identityId);
    return this.onboardingService.completeEkyc(identityId, dto);
  }

  /*
 * ==========================================
 * 2 FACTOR AUTHENTICATION
 * ==========================================
 */

@Post('2fa')
completeTwoFactorAuth(
  @Headers(
    'x-debug-identity-id',
  )
  identityId: string,

  @Body()
  dto: VimopayTwoFactorDto,
) {
  this.ensureDebugAllowed();

  this.validateIdentityId(
    identityId,
  );

  return this.onboardingService
    .completeTwoFactorAuth(
      identityId,
      dto,
    );
}
}
