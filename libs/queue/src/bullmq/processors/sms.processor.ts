import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
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

    switch (job.name) {
      case SMS_JOB_NAMES.SEND:
        await this.sendSms(job.data);
        break;

      default:
        this.logger.warn(`Unknown SMS Job: ${job.name}`);
    }
  }

  private async sendSms(data: {
    phoneNumber: string;
    message: string;
  }): Promise<void> {
    await this.smsService.sendSms(data.phoneNumber, data.message);
    // this.logger.log('====================================');
    // this.logger.log('SMS QUEUE');
    // this.logger.log(`Phone   : ${data.phoneNumber}`);
    // this.logger.log(`Message : ${data.message}`);
    // this.logger.log('====================================');
  }
}
