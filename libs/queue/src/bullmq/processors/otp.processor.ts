import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  EMAIL_JOB_NAMES,
  OTP_JOB_NAMES,
  QUEUE_NAMES,
  SMS_JOB_NAMES,
} from '../constants/bullmq.constants';
import { BadRequestException, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService } from '../services/queue.service';
import { OtpJob } from '../interfaces/otp-job.interfce';

@Processor(QUEUE_NAMES.OTP)
export class OtpProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpProcessor.name);

  constructor(private readonly queueService: QueueService) {
    super();
  }

  async process(job: Job<OtpJob>): Promise<void> {
    this.logger.log(`Processing OTP Job: ${job.name} (${job.id})`);

    switch (job.name) {
      case OTP_JOB_NAMES.SEND:
        await this.sendOtp(job.data);
        break;
      default:
        throw new Error(`Unknown OTP job: ${job.name}`);
    }

    this.logger.log(`OTP job ${job.id} completed`);
  }

  private async sendOtp(data: OtpJob): Promise<void> {
    if (!data.otp) {
      throw new BadRequestException(
        'OTP is required for notification delivery',
      );
    }
    if (data.type === 'EMAIL') {
      if (!data.email) {
        throw new BadRequestException(
          'Email address is required for OTP delivery',
        );
      }
      await this.queueService.add(QUEUE_NAMES.EMAIL, EMAIL_JOB_NAMES.SEND, {
        to: data.email,
        otp: data.otp,
      });
      return;
    }
    if (data.type === 'PHONE') {
      if (!data.phoneNumber) {
        throw new BadRequestException(
          'Phone number is required for OTP delivery',
        );
      }
      await this.queueService.add(QUEUE_NAMES.SMS, SMS_JOB_NAMES.SEND, {
        phoneNumber: data.phoneNumber,
        message: `Your OTP is${data.otp}`,
      });
      return;
    }
    throw new BadRequestException(
      `Unsupported OTP notification type: ${data.type}`,
    );
  }
}
