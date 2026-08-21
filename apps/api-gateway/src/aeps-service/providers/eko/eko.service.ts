import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ClientKafka } from '@nestjs/microservices';
import { AEPS_PATTERNS } from '@nexus/common/aeps/aeps.patterns';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';
import { OnboardEkoMerchantCommandDto } from '@nexus/common/aeps/dto/onboard-eko-merchant-command.dto';

@Injectable()
export class EkoService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject('EKO_AEPS_SERVICE')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    // this.client.subscribeToResponseOf(AEPS_PATTERNS.ONBOARD_USER);
    this.client.subscribeToResponseOf(AEPS_PATTERNS.GET_ALL_SERVICES);
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async getAllEkoServices() {
    return firstValueFrom(this.client.send(AEPS_PATTERNS.GET_ALL_SERVICES, {}));
  }

  async onboardMerchant(identityId: string, dto: OnboardEkoUserDto) {
    const command: OnboardEkoMerchantCommandDto = {
      ...dto,
      identityId,
    };

    return firstValueFrom(
      this.client.send(AEPS_PATTERNS.ONBOARD_USER, command),
    );
  }
}
