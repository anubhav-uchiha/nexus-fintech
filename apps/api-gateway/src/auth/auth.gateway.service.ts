import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import {
  ChangeMpinDto,
  ChangePasswordDto,
  LogoutDto,
  RefreshTokenDto,
} from '@nexus/common';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';
import { ChangeLoginMethodDto } from '@nexus/common/auth/dto/change-login-method.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthGatewayService implements OnModuleInit {
  constructor(
    @Inject('AUTH_SERVICE')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_ROLE);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_SEND_OTP);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_VERIFY_OTP);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_PAN);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_DETAILS);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.LOGIN);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.SEND_PHONE_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.SEND_EMAIL_OTP);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.VERIFY_PHONE_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.VERIFY_EMAIL_OTP);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REFRESH_TOKEN);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.CHANGE_PASSWORD);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.CHANGE_MPIN);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.LOGOUT);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.CACHE_TEST);

    await this.client.connect();
  }

  registerRole(dto: any) {
    console.log('Sending to kafka', dto);
    return firstValueFrom(this.client.send(AUTH_PATTERNS.REGISTER_ROLE, dto));
  }

  registerSendOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REGISTER_SEND_OTP, dto),
    );
  }

  registerVerifyOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REGISTER_VERIFY_OTP, dto),
    );
  }

  registerPan(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.REGISTER_PAN, dto));
  }

  registerDetails(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REGISTER_DETAILS, dto),
    );
  }

  changeLoginMethod(dto: ChangeLoginMethodDto, identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.CHANGE_LOGIN_METHOD, {
        identityId,
        ...dto,
      }),
    );
  }

  login(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.LOGIN, dto));
  }

  sendPhoneOtp(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.SEND_PHONE_OTP, dto));
  }

  sendEmailOtp(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.SEND_EMAIL_OTP, dto));
  }

  verifyPhoneOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.VERIFY_PHONE_OTP, dto),
    );
  }

  verifyEmailOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.VERIFY_EMAIL_OTP, dto),
    );
  }

  refreshToken(dto: RefreshTokenDto) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.REFRESH_TOKEN, dto));
  }

  changePassword(dto: ChangePasswordDto, identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.CHANGE_PASSWORD, {
        identityId,
        ...dto,
      }),
    );
  }

  changeMpin(dto: ChangeMpinDto, identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.CHANGE_MPIN, {
        identityId,
        ...dto,
      }),
    );
  }

  logout(dto: LogoutDto) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.LOGOUT, dto));
  }

  cacheTest() {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.CACHE_TEST, {}));
  }
}
