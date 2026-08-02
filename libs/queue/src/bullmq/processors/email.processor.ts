import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EMAIL_JOB_NAMES, QUEUE_NAMES } from '../constants/bullmq.constants';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from 'libs/notification/src';
import { EmailJob } from '../interfaces/email-job.interface';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  constructor(private readonly emailService: EmailService) {
    super();
  }
  async process(job: Job<EmailJob>): Promise<void> {
    this.logger.log(`Processing EMail Job: ${job.name} (${job.id})`);
    try {
      switch (job.name) {
        case EMAIL_JOB_NAMES.SEND:
          await this.sendEmail(job.data);
          break;
        default:
          this.logger.warn(`Unknown Email Job: ${job.name}`);
      }
    } catch (error) {
      this.logger.warn(error);
      throw error;
    }
  }

  private async sendEmail(data: EmailJob) {
    await this.emailService.sendOtp(data.to, data.otp);
    // await this.emailService.sendEmail(
    //   data.to,
    //   data.subject,
    //   data.html ?? data.text ?? '',
    // );
    // this.logger.log('==================');
    // this.logger.log('Email QUEUE');
    // this.logger.log(`To      : ${data.to}`);
    // this.logger.log(`Subject : ${data.subject}`);

    // if (data.text) {
    //   this.logger.log(`Text   : ${data.text}`);
    // }
    // if (data.html) {
    //   this.logger.log(`HTML   : ${data.html}`);
    // }
    // this.logger.log('===========================');
  }
}
