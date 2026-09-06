import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

import { CreateAdminAccountDto } from '@nexus/common';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';

@Injectable()
export class AdminServiceService implements OnModuleInit {
  constructor(
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    this.authClient.subscribeToResponseOf(
      AUTH_PATTERNS.CREATE_IDENTITY_ACCOUNT,
    );

    await this.authClient.connect();
  }

  createAccount(creatorIdentityId: string, account: CreateAdminAccountDto) {
    return firstValueFrom(
      this.authClient
        .send(AUTH_PATTERNS.CREATE_IDENTITY_ACCOUNT, {
          creatorIdentityId,
          account,
        })
        .pipe(timeout(10000)),
    );
  }
}
