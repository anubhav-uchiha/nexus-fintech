import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, SMS_JOB_NAMES } from '../constants/bullmq.constants';
import { SmsService } from 'libs/notification/src';
import { SmsJob } from '../interfaces/sms-job.interface';

@Processor(QUEUE_NAMES.SMS)
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(private readonly smsService: SmsService) {
    super();
  }

  async process(job: Job<SmsJob>): Promise<void> {
    this.logger.log(`Processing SMS Job: ${job.name} (${job.id})`);

    try {
      switch (job.name) {
        case SMS_JOB_NAMES.SEND:
          await this.sendSms(job.data);
          break;

        default:
          throw new Error(`Unknown SMS job: ${job.name}`);
      }
      this.logger.log(`SMS job ${job.id} completed`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown SMS processing error';

      this.logger.error(`SMS job ${job.id} failed: ${message}`);

      throw error;
    }
  }

  private async sendSms(data: SmsJob): Promise<void> {
    if (!data.phoneNumber) {
      throw new BadRequestException('SMS phone number is required');
    }

    if (!data.message) {
      throw new BadRequestException('SMS message is required');
    }
    await this.smsService.sendSms(data.phoneNumber, data.message);
  }
}
