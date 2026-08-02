import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  EMAIL_JOB_NAMES,
  OTP_JOB_NAMES,
  QUEUE_NAMES,
  SMS_JOB_NAMES,
} from '../constants/bullmq.constants';
import { Logger } from '@nestjs/common';
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
    const { type, email, phoneNumber, otp } = job.data;
    this.logger.log(`Processing OTP Job: ${job.name} (${job.id})`);

    this.logger.log(job.data);

    if (type === 'EMAIL') {
      this.logger.log(`Sending OTP ${otp} to email ${email}`);
    } else {
      this.logger.log(`Sending OTP ${otp} to phone ${phoneNumber}`);
    }

    switch (job.name) {
      case OTP_JOB_NAMES.SEND:
        await this.sendOtp(job.data);
        break;

      default:
        this.logger.warn(`Unknow OTP job: ${Job.name}`);
    }
  }

  private async sendOtp(data: any): Promise<void> {
    if (data.type === 'EMAIL') {
      await this.queueService.add(QUEUE_NAMES.EMAIL, EMAIL_JOB_NAMES.SEND, {
        to: data.email,
        otp: data.otp,
        // subject: 'OTP Verification',
        // html: `<h2>Your OTP</h2>
        //     <h1>${data.otp}</h1>
        //     <p>Vaild for 5 minutes</p>`,
      });
      return;
    }
    if (data.type === 'PHONE') {
      await this.queueService.add(QUEUE_NAMES.SMS, SMS_JOB_NAMES.SEND, {
        phoneNUmber: data.phoneNUmber,
        message: `Your OTP is${data.otp}`,
      });
    }
    // this.logger.log(`Processing OTP job`);
    // this.logger.log(JSON.stringify(data, null, 2));

    // if (data.phoneNumber) {
    //   this.logger.log(`Sending OTP ${data.otp} to phone ${data.phoneNumber}`);
    // }
    // if (data.email) {
    //   this.logger.log(`Sending OTP ${data.otp} to email ${data.email}`);
    // }
  }
}
