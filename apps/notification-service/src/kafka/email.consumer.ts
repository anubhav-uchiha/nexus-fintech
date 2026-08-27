import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from 'libs/kafka/src';
import { EmailJob } from 'libs/queue/src';
import {
  EMAIL_JOB_NAMES,
  QUEUE_NAMES,
} from 'libs/queue/src/bullmq/constants/bullmq.constants';
import { QueueService } from 'libs/queue/src/bullmq/services/queue.service';

interface EmailSendEvent extends EmailJob {
  eventId: string;
}

@Controller()
export class EmailConsumer {
  private readonly logger = new Logger(EmailConsumer.name);
  constructor(private readonly queueService: QueueService) {}

  @EventPattern(KAFKA_TOPICS.EMAIL_SEND)
  async handleEmail(@Payload() data: EmailSendEvent): Promise<void> {
    if (
      !data ||
      typeof data.eventId !== 'string' ||
      !data.eventId.trim() ||
      typeof data.to !== 'string' ||
      !data.to.trim() ||
      typeof data.otp !== 'string' ||
      !data.otp.trim()
    ) {
      this.logger.error('Rejected invalid email notification event');

      return;
    }

    await this.queueService.add<EmailJob>(
      QUEUE_NAMES.EMAIL,
      EMAIL_JOB_NAMES.SEND,
      {
        to: data.to.trim(),
        otp: data.otp,
      },
      {
        jobId: `email-${data.eventId}`,
      },
    );

    this.logger.log(`Email notification event ${data.eventId} queued`);
  }
}
