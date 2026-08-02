import { Module } from '@nestjs/common';
import { EmailConsumer } from './email.consumer';
import { SmsConsumer } from './sms.consumer';

@Module({ controllers: [EmailConsumer, SmsConsumer] })
export class NotificationKafkaModule {}
