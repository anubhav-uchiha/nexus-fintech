import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@nexus/common';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';

interface NotificationRecipient {
  identityId: string;
  phoneNumber?: string;
  email?: string;
}

@Injectable()
export class NotificationRecipientService implements OnModuleInit {
  private readonly logger = new Logger(NotificationRecipientService.name);

  constructor(
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    this.authClient.subscribeToResponseOf(
      AUTH_PATTERNS.RESOLVE_NOTIFICATION_RECIPIENT,
    );

    await this.authClient.connect();
    this.logger.log('Auth recipient resolver connected');
  }

  async resolve(identityId: string): Promise<NotificationRecipient> {
    try {
      return await firstValueFrom(
        this.authClient
          .send<NotificationRecipient>(
            AUTH_PATTERNS.RESOLVE_NOTIFICATION_RECIPIENT,
            { identityId },
          )
          .pipe(timeout(10_000)),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new Error(
          'Auth Service timed out while resolving notification recipient',
        );
      }
      throw error;
    }
  }
}
