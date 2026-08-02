import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  SendEmailOtpDto,
  SendPhoneOtpDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from '@nexus/common/auth';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';

@Controller()
export class AuthKafkaController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.SEND_PHONE_OTP)
  sendPhoneOtp(@Payload() dto: SendPhoneOtpDto) {
    return this.authService.sendPhoneOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.SEND_EMAIL_OTP)
  sendEmailOtp(@Payload() dto: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_PHONE_OTP)
  verifyPhoneOtp(@Payload() dto: VerifyPhoneOtpDto) {
    return this.authService.verifyPhoneOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL_OTP)
  verifyEmailOtp(@Payload() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.CACHE_TEST)
  cacheTest() {
    return this.authService.cacheTest();
  }
}
