import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  ChangeMpinDto,
  ChangePasswordDto,
  LoginDto,
  SuperAdminSendPhoneOtpDto,
  SuperAdminVerifyPhoneOtpDto,
} from '@nexus/common/auth';
import { SUPER_ADMIN_AUTH_COOKIE } from '@nexus/common/auth/auth.constants';
import { RateLimitProfile } from '../common/rate-limit/rate-limt.decorator';
import { AuthGatewayService } from './auth.gateway.service';
import { extractRequestMetadata } from './utils/request-metadata.util';
import { SuperAdminAuthGuard } from './guards/super-admin-auth.guard';
import { CurrentUser } from './decorator/current-user.decorator';
// import { JwtPayload } from './intercaces/jwt-payload.interface';
import { SuperAdminPanOnboardingDto } from '@nexus/common/auth/dto/super-admin/super-admin-pan-onboarding.dto';
import { JwtPayload } from 'apps/auth-service/src/auth/jwt/interfaces/jwt-payload.interface';
import { VerifyDeviceLoginDto } from '@nexus/common/auth/dto/verify-device-login.dto';

@ApiTags('Super Admin Authentication')
@Controller('super-admin/auth')
export class SuperAdminAuthController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @RateLimitProfile('LOGIN')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Super Admin login',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = extractRequestMetadata(req);

    const result = await this.authGatewayService.superAdminLogin(dto, metadata);

    if (
      'requiresDeviceVerification' in result &&
      result.requiresDeviceVerification === true
    ) {
      return result;
    }

    res.cookie(SUPER_ADMIN_AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/super-admin/auth',
      expires: new Date(result.refreshExpiresAt),
    });

    return {
      accessToken: result.accessToken,
      onboardingRequired: result.onboardingRequired,
      ...(result.onboardingRequired && {
        onboardingStatus: result.onboardingStatus,
        nextStep: result.nextStep,
      }),

      superAdmin: result.superAdmin,
    };
  }

  @RateLimitProfile('REFRESH')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Super Admin access token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[SUPER_ADMIN_AUTH_COOKIE.REFRESH_TOKEN];

    if (!refreshToken) {
      throw new UnauthorizedException('Super Admin refresh token missing');
    }

    const result = await this.authGatewayService.superAdminRefresh({
      refreshToken,
    });

    res.cookie(SUPER_ADMIN_AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/super-admin/auth',
      expires: new Date(result.refreshExpiresAt),
    });

    return {
      accessToken: result.accessToken,
      onboardingRequired: result.onboardingRequired,
      onboardingStatus: result.onboardingStatus,
      nextStep: result.nextStep,
      superAdmin: result.superAdmin,
    };
  }

  @RateLimitProfile('SESSION_MANAGEMENT')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Super Admin logout',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[SUPER_ADMIN_AUTH_COOKIE.REFRESH_TOKEN];

    if (!refreshToken) {
      throw new UnauthorizedException('Super Admin refresh token missing');
    }

    const result = await this.authGatewayService.superAdminLogout({
      refreshToken,
    });

    res.clearCookie(SUPER_ADMIN_AUTH_COOKIE.REFRESH_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/super-admin/auth',
    });

    return result;
  }

  @RateLimitProfile('OTP_SEND')
  @Post('onboarding/phone/send-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminAuthGuard)
  @ApiOperation({
    summary: 'Add Super Admin phone number and send OTP',
  })
  sendPhoneOnboardingOtp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SuperAdminSendPhoneOtpDto,
  ) {
    return this.authGatewayService.sendSuperAdminPhoneOnboardingOtp(
      user.sub,
      dto,
    );
  }

  @RateLimitProfile('OTP_VERIFY')
  @Post('onboarding/phone/verify-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminAuthGuard)
  @ApiOperation({
    summary: 'Verify Super Admin phone OTP',
  })
  verifyPhoneOnboardingOtp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SuperAdminVerifyPhoneOtpDto,
  ) {
    return this.authGatewayService.verifySuperAdminPhoneOnboardingOtp(
      user.sub,
      dto,
    );
  }

  @RateLimitProfile('REGISTRATION')
  @Post('onboarding/pan')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminAuthGuard)
  @ApiOperation({
    summary: 'Add PAN during Super Admin onboarding',
  })
  addPanForOnboarding(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SuperAdminPanOnboardingDto,
  ) {
    return this.authGatewayService.addSuperAdminOnboardingPan(user.sub, dto);
  }

  @Post('onboarding/change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminAuthGuard)
  changePassword(
    @CurrentUser() superAdmin: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authGatewayService.changeSuperAdminPassword(
      superAdmin.sub,
      superAdmin.sid,
      dto,
    );
  }

  @Post('onboarding/change-mpin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminAuthGuard)
  changeMpin(
    @CurrentUser() superAdmin: JwtPayload,
    @Body() dto: ChangeMpinDto,
  ) {
    return this.authGatewayService.changeSuperAdminMpin(
      superAdmin.sub,
      superAdmin.sid,
      dto,
    );
  }

  @RateLimitProfile('OTP_VERIFY')
  @Post('login/verify-device')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Super Admin new-device login OTP',
  })
  async verifyDeviceLogin(
    @Body() dto: VerifyDeviceLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result =
      await this.authGatewayService.superAdminVerifyDeviceLogin(dto);

    res.cookie(SUPER_ADMIN_AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/super-admin/auth',
      expires: new Date(result.refreshExpiresAt),
    });

    return {
      success: true,
      accessToken: result.accessToken,
      trustedDevice: result.trustedDevice,
      onboardingRequired: result.onboardingRequired,
      ...(result.onboardingRequired && {
        onboardingStatus: result.onboardingStatus,
        nextStep: result.nextStep,
      }),
      superAdmin: result.superAdmin,
    };
  }
}
