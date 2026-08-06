import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import {
  EMAIL_JOB_NAMES,
  QUEUE_NAMES,
} from 'libs/queue/src/bullmq/constants/bullmq.constants';
import { QueueService } from 'libs/queue/src/bullmq/services/queue.service';

@Controller()
export class EmailConsumer {
  constructor(private readonly queueService: QueueService) {}

  @EventPattern(KAFKA_TOPICS.EMAIL_SEND)
  async handleEmail(@Payload() data: any) {
    console.log('📩 Email Event Received');

    console.log(data);

    await this.queueService.add(QUEUE_NAMES.EMAIL, EMAIL_JOB_NAMES.SEND, data);
  }
}
