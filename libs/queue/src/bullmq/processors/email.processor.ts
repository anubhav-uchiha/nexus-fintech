import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EMAIL_JOB_NAMES, QUEUE_NAMES } from '../constants/bullmq.constants';
import { BadRequestException, Logger } from '@nestjs/common';
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
          throw new Error(`Unknown email job: ${job.name}`);
      }
      this.logger.log(`Email job ${job.id} completed`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown email processing error';
      this.logger.error(`Email job ${job.id} failed: ${message}`);
      throw error;
    }
  }

  private async sendEmail(data: EmailJob): Promise<void> {
    if (!data.to) {
      throw new BadRequestException('Email recipient is required');
    }

    if (!data.otp) {
      throw new BadRequestException('Email OTP is required');
    }

    await this.emailService.sendOtp(data.to, data.otp);
  }
}
