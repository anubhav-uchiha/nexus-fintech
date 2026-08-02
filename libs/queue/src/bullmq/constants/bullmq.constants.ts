export const QUEUE_NAMES = {
  OTP: 'otp',
  EMAIL: 'email',
  SMS: 'sms',
  NOTIFICATION: 'notification',
} as const;

export const OTP_JOB_NAMES = {
  SEND: 'send-otp',
} as const;

export const EMAIL_JOB_NAMES = {
  SEND: 'send-email',
} as const;

export const SMS_JOB_NAMES = {
  SEND: 'send-sms',
} as const;

export const NOTIFICATION_JOB_NAMES = {
  SEND: 'send-notification',
} as const;
