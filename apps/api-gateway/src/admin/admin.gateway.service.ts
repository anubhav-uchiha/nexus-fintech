import {
  GatewayTimeoutException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { ADMIN_PATTERNS, CreateAdminAccountDto } from '@nexus/common/admin';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';

@Injectable()
export class AdminGatewayService implements OnModuleInit {
  constructor(
    @Inject('ADMIN_SERVICE')
    private readonly adminClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    this.adminClient.subscribeToResponseOf(ADMIN_PATTERNS.CREATE_ACCOUNT);

    await this.adminClient.connect();
  }

  async createAccount(
    creatorIdentityId: string,
    account: CreateAdminAccountDto,
  ) {
    try {
      return await firstValueFrom(
        this.adminClient
          .send(ADMIN_PATTERNS.CREATE_ACCOUNT, {
            creatorIdentityId,
            account,
          })
          .pipe(timeout(10000)),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new GatewayTimeoutException(
          'Admin Service did not respond in time',
        );
      }

      throw error;
    }
  }
}
