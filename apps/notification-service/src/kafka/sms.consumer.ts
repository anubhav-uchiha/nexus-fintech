import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import { SmsJob } from 'libs/queue/src';
import {
  QUEUE_NAMES,
  SMS_JOB_NAMES,
} from 'libs/queue/src/bullmq/constants/bullmq.constants';
import { QueueService } from 'libs/queue/src/bullmq/services/queue.service';

interface SmsSendEvent extends SmsJob {
  eventId: string;
}

@Controller()
export class SmsConsumer {
  private readonly logger = new Logger(SmsConsumer.name);
  constructor(private readonly queueService: QueueService) {}

  @EventPattern(KAFKA_TOPICS.SMS_SEND)
  async handleSms(@Payload() data: SmsSendEvent): Promise<void> {
    if (
      !data ||
      typeof data.eventId !== 'string' ||
      !data.eventId.trim() ||
      typeof data.phoneNumber !== 'string' ||
      !data.phoneNumber.trim() ||
      typeof data.message !== 'string' ||
      !data.message.trim()
    ) {
      this.logger.error('Rejected invalid SMS notification event');

      return;
    }
    await this.queueService.add<SmsJob>(
      QUEUE_NAMES.SMS,
      SMS_JOB_NAMES.SEND,
      {
        phoneNumber: data.phoneNumber.trim(),
        message: data.message,
      },
      {
        jobId: `sms-${data.eventId}`,
      },
    );

    this.logger.log(`SMS notification event ${data.eventId} queued`);
  }
}
