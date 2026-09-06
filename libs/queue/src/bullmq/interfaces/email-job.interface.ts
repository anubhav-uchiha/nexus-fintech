export interface OtpEmailJob {
  type: 'OTP';
  to: string;
  otp: string;
}

export interface AccountCredentialsEmailJob {
  type: 'ACCOUNT_CREDENTIALS';
  to: string;
  loginId: string;
  temporaryPassword: string;
  temporaryMpin: string;
  fullName?: string;
  role?: string;
  expiresAt?: string;
}

export type EmailJob = OtpEmailJob | AccountCredentialsEmailJob;
