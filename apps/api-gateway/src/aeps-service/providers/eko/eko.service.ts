import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { BadRequestError } from 'libs/errors/ApiError';
import crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { ClientKafka } from '@nestjs/microservices';
import { AEPS_PATTERNS } from '@nexus/common/aeps/aeps.patterns';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';
import { IdentityDto } from 'libs/common/dto/IdentityDto';
import { BANK_ACCOUNT_PATTERNS } from '@nexus/common/identity-bank-account/identity-bank-account.patterns';
@Injectable()
export class EkoService implements OnModuleInit {
  constructor(
    @Inject('EKO_AEPS_SERVICE')
    private readonly client: ClientKafka,
  ) {}
  async onModuleInit() {
    this.client.subscribeToResponseOf(AEPS_PATTERNS.ONBOARD_USER);
    this.client.subscribeToResponseOf(AEPS_PATTERNS.GET_ALL_SERVICES);
    await this.client.connect();
  }
  async getAllEkoServices() {
    return firstValueFrom(this.client.send(AEPS_PATTERNS.GET_ALL_SERVICES, {}));
  }

  async OnboardMerchant(dto: OnboardEkoUserDto) {
    return firstValueFrom(this.client.send(AEPS_PATTERNS.ONBOARD_USER, dto));
  }

  async getBankList() {
    return firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.GET_BANK_LIST, {}),
    );
  }
}
