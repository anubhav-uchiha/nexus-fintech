import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phoneNumber: string, otp: string) {
    this.logger.log(`Sending OTP ${otp} to ${phoneNumber}`);

    /**
     * Next Step:
     * Integrate Twilio / MSG91 / Fast2SMS here.
     */

    return true;
  }

  async sendSms(phoneNumber: string, message: string) {
    this.logger.log('Sending SMS');

    this.logger.log({
      phoneNumber,
      message,
    });

    return true;
  }
}
