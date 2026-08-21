import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AuthService } from './auth.service';

import {
  ChangeMpinDto,
  LogoutDto,
  RefreshTokenDto,
  SendEmailOtpDto,
  SendPhoneOtpDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from '@nexus/common/auth';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';
import { RegisterRoleDto } from '@nexus/common/auth/dto/register/register-role.dto';
import { RegisterPhoneDto } from '@nexus/common/auth/dto/register/register-phone.dto';
import { VerifyRegistrationOtpDto } from '@nexus/common/auth/dto/register/verify-registration-otp.dto';
import { RegisterPanDto } from '@nexus/common/auth/dto/register/register-pan.dto';
import { RegisterDetailsDto } from '@nexus/common/auth/dto/register/register-details.dto';
import { LoginMethod } from 'apps/auth-service/generated/prisma/enums';
import { VerifyForgotPasswordUserDto } from '@nexus/common/auth/dto/forgot-password/verify-user.dto';
import { VerifyForgotPasswordOtpDto } from '@nexus/common/auth/dto/forgot-password/verify-forgot-password-otp.dto';
import { ResetForgotPasswordDto } from '@nexus/common/auth/dto/forgot-password/reset-forgot-password.dto';
import { LoginKafkaDto } from '@nexus/common/auth/dto/login-kafka.dto';

@Controller()
export class AuthKafkaController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER_ROLE)
  registerRole(@Payload() dto: RegisterRoleDto) {
    console.log('KAFKA received:', dto);
    return this.authService.registerRole(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REGISTER_SEND_OTP)
  registerSendOtp(@Payload() dto: RegisterPhoneDto) {
    return this.authService.registerSendOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REGISTER_VERIFY_OTP)
  registerVerifyOtp(@Payload() dto: VerifyRegistrationOtpDto) {
    return this.authService.registerVerifyOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REGISTER_PAN)
  registerPan(@Payload() dto: RegisterPanDto) {
    return this.authService.registerPan(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REGISTER_DETAILS)
  registerDetails(@Payload() dto: RegisterDetailsDto) {
    return this.authService.registerDetails(dto);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_LOGIN_METHOD)
  changeLoginMethod(
    @Payload() dto: { identityId: string; preferredLoginMethod: LoginMethod },
  ) {
    return this.authService.changeLoginMethod(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginKafkaDto) {
    return this.authService.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload()
    dto: {
      identityId: string;
      currentPassword: string;
      newPassword: string;
    },
  ) {
    return this.authService.changePassword(dto);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_MPIN)
  changeMpin(@Payload() dto: ChangeMpinDto & { identityId: string }) {
    return this.authService.changeMpin(dto);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD_VERIFY_USER)
  forgotPasswordVerifyUser(@Payload() dto: VerifyForgotPasswordUserDto) {
    return this.authService.forgotPasswordVerifyUser(dto);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD_VERIFY_OTP)
  forgotPasswordVerifyOtp(@Payload() dto: VerifyForgotPasswordOtpDto) {
    return this.authService.forgotPasswordVerifyOtp(dto);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD_RESET)
  forgotPasswordReset(@Payload() dto: ResetForgotPasswordDto) {
    return this.authService.forgotPasswordReset(dto);
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

  @MessagePattern(AUTH_PATTERNS.REFRESH_TOKEN)
  refresh(@Payload() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() dto: LogoutDto) {
    return this.authService.logout(dto);
  }

  @MessagePattern(AUTH_PATTERNS.CACHE_TEST)
  cacheTest() {
    return this.authService.cacheTest();
  }
}
