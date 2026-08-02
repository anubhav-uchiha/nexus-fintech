import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from 'libs/kafka/src';
import { NotificationModule } from 'libs/notification/src';
import { BullMQModule } from 'libs/queue/src/bullmq/bullmq.module';
import { NotificationKafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule,
    BullMQModule,
    NotificationModule,
    NotificationKafkaModule,
  ],
})
export class NotificationServiceModule {}
