import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthGatewayService } from './auth.gateway.service';

import {
  ChangeMpinDto,
  ChangePasswordDto,
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

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post('register/role')
  @ApiOperation({
    summary: 'Step 1 - Select Role',
  })
  registerRole(@Body() dto: RegisterRoleDto) {
    console.log('Controller hit');
    return this.authGatewayService.registerRole(dto);
  }

  @Post('register/phone')
  @ApiOperation({
    summary: 'Step 2 - Send OTP to Phone',
  })
  registerPhone(@Body() dto: RegisterPhoneDto) {
    return this.authGatewayService.registerSendOtp(dto);
  }

  @Post('register/verify-otp')
  @ApiOperation({
    summary: 'Step 3 - Verify Phone OTP',
  })
  verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return this.authGatewayService.registerVerifyOtp(dto);
  }

  @Post('register/pan')
  @ApiOperation({
    summary: 'Step 4 - Verify PAN',
  })
  registerPan(@Body() dto: RegisterPanDto) {
    return this.authGatewayService.registerPan(dto);
  }

  @Post('register/details')
  @ApiOperation({
    summary: 'Step 5 - Complete Registration',
  })
  registerDetails(@Body() dto: RegisterDetailsDto) {
    return this.authGatewayService.registerDetails(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
  })
  @ApiResponse({
    status: 200,
    type: LoginResponseDto,
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authGatewayService.login(dto);

    res.cookie(AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: result.refreshExpiresAt,
    });
    return {
      accessToken: result.accessToken,
      identity: result.identity,
    };
  }

  @Post('send-phone-otp')
  sendPhoneOtp(@Body() dto: SendPhoneOtpDto) {
    return this.authGatewayService.sendPhoneOtp(dto);
  }

  @Post('send-email-otp')
  sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.authGatewayService.sendEmailOtp(dto);
  }

  @Post('verify-phone-otp')
  verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto) {
    return this.authGatewayService.verifyPhoneOtp(dto);
  }

  @Post('verify-email-otp')
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authGatewayService.verifyEmailOtp(dto);
  }

  @Post('refresh')
  @ApiResponse({ status: 200, type: RefreshTokenResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    console.log('Cookies:', req.cookies);
    console.log('Header:', req.headers.cookie);

    const refreshToken = req.cookies?.[AUTH_COOKIE.REFRESH_TOKEN];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const result = await this.authGatewayService.refreshToken({ refreshToken });

    res.cookie(AUTH_COOKIE.REFRESH_TOKEN, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: result.refreshExpiresAt,
    });

    return {
      accessToken: result.accessToken,
      identity: result.identity,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authGatewayService.changePassword(dto, user.sub);
  }

  @Post('change-mpin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changeMpin(@CurrentUser() user: JwtPayload, @Body() dto: ChangeMpinDto) {
    return this.authGatewayService.changeMpin(dto, user.sub);
  }

  @Post('forgot-password/verify-user')
  forgotPasswordVerifyUser(@Body() dto: VerifyForgotPasswordUserDto) {
    console.log(dto);
    return this.authGatewayService.forgotPasswordVerifyUser(dto);
  }

  @Post('forgot-password/verify-otp')
  forgotPasswordVerifyOtp(@Body() dto: VerifyForgotPasswordOtpDto) {
    return this.authGatewayService.forgotPasswordVerifyOtp(dto);
  }

  @Post('forgot-password/reset')
  forgotPasswordReset(@Body() dto: ResetForgotPasswordDto) {
    return this.authGatewayService.forgotPasswordReset(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    console.log('Cookies:', req.cookies);
    console.log('Header:', req.headers.cookie);

    const refreshToken = req.cookies?.[AUTH_COOKIE.REFRESH_TOKEN];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const logout = await this.authGatewayService.logout({ refreshToken });

    res.clearCookie(AUTH_COOKIE.REFRESH_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: logout.refreshExpiresAt,
    });
    return {
      message: 'Logout Successfully',
    };
  }

  @Get('me/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get effective permissions for the logged-in identity',
  })
  getMyPermissions(@CurrentUser() user: JwtPayload) {
    return this.authGatewayService.resolveIdentityPermissions(user.sub);
  }

  @Get('cache-test')
  cacheTest() {
    return this.authGatewayService.cacheTest();
  }
}
