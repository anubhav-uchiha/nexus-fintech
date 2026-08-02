import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import {
  QUEUE_NAMES,
  SMS_JOB_NAMES,
} from 'libs/queue/src/bullmq/constants/bullmq.constants';
import { QueueService } from 'libs/queue/src/bullmq/services/queue.service';

@Controller()
export class SmsConsumer {
  constructor(private readonly queueService: QueueService) {}

  @EventPattern(KAFKA_TOPICS.SMS_SEND)
  async handleSms(@Payload() data: any) {
    console.log('📱 SMS Event Received');

    console.log(data);
    await this.queueService.add(QUEUE_NAMES.SMS, SMS_JOB_NAMES.SEND, data);
  }
}
