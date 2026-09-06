import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { AuthGatewayService } from './auth.gateway.service';

import {
  ChangeMpinDto,
  ChangePasswordDto,
  DeviceVerificationRequiredResponseDto,
  IdentityOnboardingPanDto,
  IdentityOnboardingSendPhoneDto,
  IdentityOnboardingVerifyPhoneDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  SendEmailOtpDto,
  SendPhoneOtpDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from '@nexus/common/auth';
import { AUTH_COOKIE } from '@nexus/common/auth/auth.constants';
import { RegisterRoleDto } from '@nexus/common/auth/dto/register/register-role.dto';
import { RegisterPhoneDto } from '@nexus/common/auth/dto/register/register-phone.dto';
import { VerifyRegistrationOtpDto } from '@nexus/common/auth/dto/register/verify-registration-otp.dto';
import { RegisterPanDto } from '@nexus/common/auth/dto/register/register-pan.dto';
import { RegisterDetailsDto } from '@nexus/common/auth/dto/register/register-details.dto';
import { JwtPayload } from 'apps/auth-service/src/auth/jwt/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from './guards/jwt-auth-guard';
import { CurrentUser } from './decorator/current-user.decorator';
import { VerifyForgotPasswordUserDto } from '@nexus/common/auth/dto/forgot-password/verify-user.dto';
import { VerifyForgotPasswordOtpDto } from '@nexus/common/auth/dto/forgot-password/verify-forgot-password-otp.dto';
import { ResetForgotPasswordDto } from '@nexus/common/auth/dto/forgot-password/reset-forgot-password.dto';
import { extractRequestMetadata } from './utils/request-metadata.util';
import { RateLimitProfile } from '../common/rate-limit/rate-limt.decorator';
import { VerifyDeviceLoginDto } from '@nexus/common/auth/dto/verify-device-login.dto';
import { DeviceLoginSuccessResponseDto } from '@nexus/common/auth/dto/response/device-login-success-response.dto';

@ApiTags('Authentication')
@ApiExtraModels(
  LoginResponseDto,
  DeviceVerificationRequiredResponseDto,
  DeviceLoginSuccessResponseDto,
)
@Controller('auth')
export class AuthController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @RateLimitProfile('REGISTRATION')
  @Post('register/role')
  @ApiOperation({
    summary: 'Step 1 - Select Role',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration role selected successfully',
  })
  registerRole(@Body() dto: RegisterRoleDto) {
    return this.authGatewayService.registerRole(dto);
  }

  @RateLimitProfile('OTP_VERIFY')
  @Post('register/phone')
  @ApiOperation({
    summary: 'Step 2 - Send OTP to Phone',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration phone OTP sent successfully',
  })
  registerPhone(@Body() dto: RegisterPhoneDto) {
    return this.authGatewayService.registerSendOtp(dto);
  }

  @RateLimitProfile('OTP_VERIFY')
  @Post('register/verify-otp')
  @ApiOperation({
    summary: 'Step 3 - Verify Phone OTP',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration phone OTP verified successfully',
  })
  verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return this.authGatewayService.registerVerifyOtp(dto);
  }

  @RateLimitProfile('REGISTRATION')
  @Post('register/pan')
  @ApiOperation({
    summary: 'Step 4 - Verify PAN',
  })
  @ApiResponse({
    status: 201,
    description: 'PAN registration step completed successfully',
  })
  registerPan(@Body() dto: RegisterPanDto) {
    return this.authGatewayService.registerPan(dto);
  }

  @RateLimitProfile('REGISTRATION')
  @Post('register/details')
  @ApiOperation({
    summary: 'Step 5 - Complete Registration',
  })
  @ApiResponse({
    status: 201,
    description: 'Identity registration completed successfully',
  })
  registerDetails(@Body() dto: RegisterDetailsDto) {
    return this.authGatewayService.registerDetails(dto);
  }

  @RateLimitProfile('LOGIN')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful or new-device verification is required',
    schema: {
      oneOf: [
        {
          $ref: getSchemaPath(LoginResponseDto),
        },
        {
          $ref: getSchemaPath(DeviceVerificationRequiredResponseDto),
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid login request',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
  })
  @ApiForbiddenResponse({
    description: 'Account inactive, blocked, or onboarding restrictions apply',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many login attempts',
  })
  async login(
    @Body() dto: LoginDto,
    @Req()
    req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = extractRequestMetadata(req);
    const result = await this.authGatewayService.login(dto, metadata);

    if (
      'requiresDeviceVerification' in result &&
      result.requiresDeviceVerification === true
    ) {
      return result;
    }

    res.cookie(AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      expires: new Date(result.refreshExpiresAt),
    });
    return {
      accessToken: result.accessToken,
      onboardingRequired: result.onboardingRequired,

      ...(result.onboardingRequired && {
        onboardingStatus: result.onboardingStatus,
        nextStep: result.nextStep,
      }),
      identity: result.identity,
    };
  }

  @RateLimitProfile('OTP_SEND')
  @ApiOperation({
    summary: 'Send OTP to registered phone number',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP sent successfully',
  })
  @Post('send-phone-otp')
  sendPhoneOtp(@Body() dto: SendPhoneOtpDto) {
    return this.authGatewayService.sendPhoneOtp(dto);
  }

  @RateLimitProfile('OTP_SEND')
  @ApiOperation({
    summary: 'Send OTP to registered email address',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP sent successfully',
  })
  @Post('send-email-otp')
  sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.authGatewayService.sendEmailOtp(dto);
  }

  @RateLimitProfile('OTP_VERIFY')
  @ApiOperation({
    summary: 'Verify phone OTP',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP verified successfully',
  })
  @Post('verify-phone-otp')
  verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto) {
    return this.authGatewayService.verifyPhoneOtp(dto);
  }

  @RateLimitProfile('OTP_VERIFY')
  @ApiOperation({
    summary: 'Verify email OTP',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP verified successfully',
  })
  @Post('verify-email-otp')
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authGatewayService.verifyEmailOtp(dto);
  }

  @ApiCookieAuth('refresh-token')
  @RateLimitProfile('REFRESH')
  @ApiOperation({
    summary: 'Refresh identity access token',
  })
  @Post('refresh')
  @ApiResponse({ status: 200, type: RefreshTokenResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh token missing, invalid, or expired',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    const refreshToken = req.cookies?.[AUTH_COOKIE.REFRESH_TOKEN];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const result = await this.authGatewayService.refreshToken({ refreshToken });

    res.cookie(AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      expires: new Date(result.refreshExpiresAt),
    });

    return {
      accessToken: result.accessToken,
      identity: result.identity,
    };
  }

  @ApiBearerAuth('access-token')
  @RateLimitProfile('CREDENTIAL_CHANGE')
  @ApiOperation({
    summary: 'Change logged-in identity password',
  })
  @Post('change-password')
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authGatewayService.changePassword(
      dto,
      user.sub,
      user.sid,
      user.role,
    );
  }

  @ApiBearerAuth('access-token')
  @RateLimitProfile('CREDENTIAL_CHANGE')
  @ApiOperation({
    summary: 'Change logged-in identity MPIN',
  })
  @ApiResponse({
    status: 200,
    description: 'MPIN changed successfully',
  })
  @Post('change-mpin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changeMpin(@CurrentUser() user: JwtPayload, @Body() dto: ChangeMpinDto) {
    return this.authGatewayService.changeMpin(
      dto,
      user.sub,
      user.sid,
      user.role,
    );
  }

  @RateLimitProfile('PASSWORD_RECOVERY')
  @ApiOperation({
    summary: 'Verify identity for forgot-password flow',
  })
  @ApiResponse({
    status: 201,
    description: 'Identity verified and password recovery initiated',
  })
  @Post('forgot-password/verify-user')
  forgotPasswordVerifyUser(@Body() dto: VerifyForgotPasswordUserDto) {
    return this.authGatewayService.forgotPasswordVerifyUser(dto);
  }

  @RateLimitProfile('PASSWORD_RECOVERY')
  @ApiOperation({
    summary: 'Verify forgot-password OTP',
  })
  @ApiResponse({
    status: 201,
    description: 'Password recovery OTP verified successfully',
  })
  @Post('forgot-password/verify-otp')
  forgotPasswordVerifyOtp(@Body() dto: VerifyForgotPasswordOtpDto) {
    return this.authGatewayService.forgotPasswordVerifyOtp(dto);
  }

  @RateLimitProfile('PASSWORD_RECOVERY')
  @ApiOperation({
    summary: 'Reset password after OTP verification',
  })
  @ApiResponse({
    status: 201,
    description: 'Password reset successfully',
  })
  @Post('forgot-password/reset')
  forgotPasswordReset(@Body() dto: ResetForgotPasswordDto) {
    return this.authGatewayService.forgotPasswordReset(dto);
  }

  @ApiCookieAuth('refresh-token')
  @RateLimitProfile('SESSION_MANAGEMENT')
  @ApiOperation({
    summary: 'Logout identity session',
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token missing, invalid, or expired',
  })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[AUTH_COOKIE.REFRESH_TOKEN];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    await this.authGatewayService.logout({ refreshToken });

    res.clearCookie(AUTH_COOKIE.REFRESH_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
    return {
      success: true,
      message: 'Logout Successfully',
    };
  }

  @ApiBearerAuth('access-token')
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user active sessions',
  })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved successfully',
  })
  getSessions(@CurrentUser() user: JwtPayload) {
    return this.authGatewayService.getSessions(user.sub, user.sid);
  }

  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Session details retrieved successfully',
  })
  @Get('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'sessionId',
    format: 'uuid',
    description: 'Session UUID',
  })
  @ApiOperation({
    summary: 'Get session details',
  })
  getSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe)
    sessionId: string,
  ) {
    return this.authGatewayService.getSession(user.sub, sessionId, user.sid);
  }

  @ApiBearerAuth('access-token')
  @RateLimitProfile('SESSION_MANAGEMENT')
  @ApiOperation({
    summary: 'Revoke all sessions except current session',
  })
  @Delete('sessions/others')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Other sessions revoked successfully',
  })
  revokeOtherSessions(@CurrentUser() user: JwtPayload) {
    return this.authGatewayService.revokeOtherSessions(user.sub, user.sid);
  }

  @ApiBearerAuth('access-token')
  @RateLimitProfile('SESSION_MANAGEMENT')
  @ApiResponse({
    status: 200,
    description: 'Session revoked successfully',
  })
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'sessionId',
    format: 'uuid',
    description: 'Session UUID',
  })
  @ApiOperation({
    summary: 'Revoke a particular session',
  })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseUUIDPipe)
    sessionId: string,
    @Res({ passthrough: true })
    res: Response,
  ) {
    const result = await this.authGatewayService.revokeSession(
      user.sub,
      sessionId,
      user.sid,
    );

    if (result.isCurrent) {
      res.clearCookie(AUTH_COOKIE.REFRESH_TOKEN, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });
    }

    return result;
  }

  @ApiBearerAuth('access-token')
  @RateLimitProfile('SESSION_MANAGEMENT')
  @ApiResponse({
    status: 200,
    description: 'All sessions revoked successfully',
  })
  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Revoke every user session',
  })
  async revokeAllSessions(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true })
    res: Response,
  ) {
    const result = await this.authGatewayService.revokeAllSessions(
      user.sub,
      user.sid,
    );

    res.clearCookie(AUTH_COOKIE.REFRESH_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return result;
  }

  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Effective permissions retrieved successfully',
  })
  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get effective permissions for the logged-in identity',
  })
  getMyPermissions(@CurrentUser() user: JwtPayload) {
    return this.authGatewayService.resolveIdentityPermissions(user.sub);
  }

  @ApiBearerAuth('access-token')
  @RateLimitProfile('OTP_SEND')
  @ApiResponse({
    status: 201,
    description: 'Onboarding phone OTP sent successfully',
  })
  @ApiOperation({
    summary: 'Add phone number and send onboarding OTP',
  })
  @Post('onboarding/phone/send-otp')
  @UseGuards(JwtAuthGuard)
  sendIdentityOnboardingPhoneOtp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: IdentityOnboardingSendPhoneDto,
  ) {
    return this.authGatewayService.sendIdentityOnboardingPhoneOtp(
      user.sub,
      dto,
    );
  }

  @ApiBearerAuth('access-token')
  @RateLimitProfile('OTP_VERIFY')
  @ApiResponse({
    status: 201,
    description: 'Onboarding phone OTP verified successfully',
  })
  @ApiOperation({
    summary: 'Verify onboarding phone OTP',
  })
  @Post('onboarding/phone/verify-otp')
  @UseGuards(JwtAuthGuard)
  verifyIdentityOnboardingPhoneOtp(
    @CurrentUser() user: JwtPayload,
    @Body() dto: IdentityOnboardingVerifyPhoneDto,
  ) {
    return this.authGatewayService.verifyIdentityOnboardingPhoneOtp(
      user.sub,
      dto,
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Add PAN during identity onboarding',
  })
  @ApiResponse({
    status: 201,
    description: 'PAN added successfully for onboarding',
  })
  @Post('onboarding/pan')
  @UseGuards(JwtAuthGuard)
  addIdentityOnboardingPan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: IdentityOnboardingPanDto,
  ) {
    return this.authGatewayService.addIdentityOnboardingPan(user.sub, dto);
  }

  @RateLimitProfile('OTP_VERIFY')
  @Post('login/verify-device')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description:
      'Device verified successfully and authentication session created',
    type: DeviceLoginSuccessResponseDto,
  })
  @ApiOperation({
    summary: 'Verify new device login OTP',
  })
  @ApiBadRequestResponse({
    description: 'Invalid OTP payload',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, already-used challenge, or incorrect OTP',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many verification attempts',
  })
  async verifyDeviceLogin(
    @Body() dto: VerifyDeviceLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authGatewayService.verifyDeviceLogin(dto);

    res.cookie(AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
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

      identity: result.identity,
    };
  }
}
