import { Module } from '@nestjs/common';
import { EmailConsumer } from './email.consumer';
import { SmsConsumer } from './sms.consumer';
import { AuthNotificationConsumer } from './auth-notification.consumer';
import { AuthNotificationService } from '../auth-notification/auth-notification.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationRecipientService } from '../auth-notification/notification-recipient.service';
import { KycNotificationConsumer } from './kyc-notification.consumer';
import { KycNotificationService } from '../kyc-notification/kyc-notification.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const brokers = (
            config.get<string>('KAFKA_BROKERS') ??
            config.get<string>('KAFKA_BROKER') ??
            'localhost:9092'
          )
            .split(',')
            .map((broker) => broker.trim())
            .filter(Boolean);

          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'notification-auth-recipient-client',
                brokers,
              },
              consumer: {
                groupId: 'notification-auth-recipient-group',
              },
            },
          };
        },
      },
    ]),
  ],
  controllers: [
    EmailConsumer,
    SmsConsumer,
    AuthNotificationConsumer,
    KycNotificationConsumer,
  ],
  providers: [
    AuthNotificationService,
    NotificationRecipientService,
    KycNotificationService,
  ],
  exports: [NotificationRecipientService],
})
export class NotificationKafkaModule {}
