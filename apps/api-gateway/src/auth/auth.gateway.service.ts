import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthGatewayService implements OnModuleInit {
  constructor(
    @Inject('AUTH_SERVICE')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.LOGIN);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.SEND_PHONE_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.SEND_EMAIL_OTP);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.VERIFY_PHONE_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.VERIFY_EMAIL_OTP);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.CACHE_TEST);

    await this.client.connect();
  }
  register(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.REGISTER, dto));
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

  cacheTest() {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.CACHE_TEST, {}));
  }
}
