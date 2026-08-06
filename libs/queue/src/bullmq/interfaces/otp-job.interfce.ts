export interface OtpJob {
  type: 'EMAIL' | 'PHONE';

  purpose: string;

  otp: string;

  email?: string;

  phoneNumber?: string;
}
