import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';
import { LoginKafkaDto } from '@nexus/common/auth/dto/login-kafka.dto';
import { SuperAdminAuthService } from './super-admin-auth.service';
import {
  ChangeMpinDto,
  ChangePasswordDto,
  CreateAdminAccountDto,
  LogoutDto,
  RefreshTokenDto,
  SuperAdminSendPhoneOtpDto,
  SuperAdminVerifyPhoneOtpDto,
} from '@nexus/common';
import { SuperAdminSessionService } from './super-admin-session.service';
import { SuperAdminPanOnboardingDto } from '@nexus/common/auth/dto/super-admin/super-admin-pan-onboarding.dto';
import { VerifyDeviceLoginDto } from '@nexus/common/auth/dto/verify-device-login.dto';

@Controller()
export class SuperAdminAuthKafkaController {
  constructor(
    private readonly superAdminAuthService: SuperAdminAuthService,
    private readonly superAdminSessionService: SuperAdminSessionService,
  ) {}
  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_VALIDATE_SESSION)
  validateSession(
    @Payload()
    payload: {
      superAdminId: string;
      sessionId: string;
    },
  ) {
    return this.superAdminSessionService.validateSession(
      payload.superAdminId,
      payload.sessionId,
    );
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_LOGIN)
  login(@Payload() dto: LoginKafkaDto) {
    return this.superAdminAuthService.login(dto);
  }
  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_REFRESH_TOKEN)
  refresh(@Payload() dto: RefreshTokenDto) {
    return this.superAdminAuthService.refresh(dto.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_LOGOUT)
  logout(@Payload() dto: LogoutDto) {
    return this.superAdminAuthService.logout(dto.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_ONBOARDING_SEND_PHONE_OTP)
  sendPhoneOnboardingOtp(
    @Payload()
    payload: SuperAdminSendPhoneOtpDto & {
      superAdminId: string;
    },
  ) {
    return this.superAdminAuthService.sendPhoneOnboardingOtp(
      payload.superAdminId,
      payload,
    );
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_ONBOARDING_VERIFY_PHONE_OTP)
  verifyPhoneOnboardingOtp(
    @Payload()
    payload: SuperAdminVerifyPhoneOtpDto & {
      superAdminId: string;
    },
  ) {
    return this.superAdminAuthService.verifyPhoneOnboardingOtp(
      payload.superAdminId,
      payload,
    );
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_ONBOARDING_ADD_PAN)
  addPanForOnboarding(
    @Payload()
    payload: SuperAdminPanOnboardingDto & {
      superAdminId: string;
    },
  ) {
    return this.superAdminAuthService.addPanForOnboarding(
      payload.superAdminId,
      payload,
    );
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_CHANGE_PASSWORD)
  changePassword(
    @Payload()
    dto: ChangePasswordDto & {
      superAdminId: string;
      sessionId: string;
    },
  ) {
    return this.superAdminAuthService.changePassword(
      dto.superAdminId,
      dto.sessionId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_CHANGE_MPIN)
  changeMpin(
    @Payload()
    dto: ChangeMpinDto & {
      superAdminId: string;
      sessionId: string;
    },
  ) {
    return this.superAdminAuthService.changeMpin(
      dto.superAdminId,
      dto.sessionId,
      dto.currentMpin,
      dto.newMpin,
    );
  }

  @MessagePattern(AUTH_PATTERNS.CREATE_IDENTITY_ACCOUNT)
  createIdentityAccount(
    @Payload()
    payload: {
      creatorIdentityId: string;
      account: CreateAdminAccountDto;
    },
  ) {
    return this.superAdminAuthService.createIdentityAccount(
      payload.creatorIdentityId,
      payload.account,
    );
  }

  @MessagePattern(AUTH_PATTERNS.SUPER_ADMIN_VERIFY_DEVICE_LOGIN)
  verifyDeviceLogin(@Payload() dto: VerifyDeviceLoginDto) {
    return this.superAdminAuthService.verifyDeviceLogin(dto);
  }
}
