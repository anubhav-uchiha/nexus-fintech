import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthGatewayService } from './auth.gateway.service';

import {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  RegisterResponseDto,
  SendEmailOtpDto,
  SendPhoneOtpDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from '@nexus/common/auth';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
  })
  @ApiResponse({
    status: 201,
    type: RegisterResponseDto,
  })
  register(@Body() dto: RegisterDto) {
    return this.authGatewayService.register(dto);
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
  login(@Body() dto: LoginDto) {
    return this.authGatewayService.login(dto);
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

  @Get('cache-test')
  cacheTest() {
    return this.authGatewayService.cacheTest();
  }
}
