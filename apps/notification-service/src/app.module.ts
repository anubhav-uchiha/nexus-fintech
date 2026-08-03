import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from 'libs/kafka/src';
import { NotificationModule } from 'libs/notification/src';
import { BullMQModule } from 'libs/queue/src/bullmq/bullmq.module';
import { NotificationKafkaModule } from './kafka/kafka.module';
import appConfig from '@nexus/config/configs/app.config';
import redisConfig from '@nexus/config/configs/redis.config';
import bullmqConfig from '@nexus/config/configs/bullmq.config';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import { notificationValidationSchema } from '@nexus/config/validation/notification.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [
        `apps/notification-service/.env.${process.env.NODE_ENV ?? 'development'}`,
        'apps/notification-service/.env',
      ],
      load: [appConfig, kafkaConfig, redisConfig, bullmqConfig],
      validationSchema: notificationValidationSchema,
    }),
    KafkaModule,
    BullMQModule,
    NotificationModule,
    NotificationKafkaModule,
  ],
})
export class NotificationServiceModule {}
