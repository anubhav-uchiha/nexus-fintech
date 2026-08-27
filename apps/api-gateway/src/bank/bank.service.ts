import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { BANK_PROVIDER_PATTERNS } from '@nexus/common/eko/eko.patterns';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BankService implements OnModuleInit {
  constructor(
    @Inject('BANK_SERVICE')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(BANK_PROVIDER_PATTERNS.GET_BANK_LIST);
    await this.client.connect();
  }
  getBanksList() {
    return firstValueFrom(
      this.client.send(BANK_PROVIDER_PATTERNS.GET_BANK_LIST, {}),
    );
  }
}
