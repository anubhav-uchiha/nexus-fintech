import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './services/queue.service';
import { QUEUE_NAMES } from './constants/bullmq.constants';
import { OtpProcessor } from './processors/otp.processor';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';
import { NotificationModule } from 'libs/notification/src';
import { QueueEventsListener } from './listeners/queue-events.listener';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
        prefix: config.get<string>('bullmq.prefix') ?? 'nexus',
      }),
    }),

    BullModule.registerQueue(
      { name: QUEUE_NAMES.OTP },
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.SMS },
      { name: QUEUE_NAMES.NOTIFICATION },
    ),
    NotificationModule,
  ],
  providers: [
    QueueService,
    OtpProcessor,
    EmailProcessor,
    SmsProcessor,
    QueueEventsListener,
  ],
  exports: [BullModule, QueueService],
})
export class BullMQModule {}
