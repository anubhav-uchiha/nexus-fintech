export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',

  SEND_PHONE_OTP: 'auth.send-phone-otp',
  SEND_EMAIL_OTP: 'auth.send-email-otp',

  VERIFY_PHONE_OTP: 'auth.verify-phone-otp',
  VERIFY_EMAIL_OTP: 'auth.verify-email-otp',

  CACHE_TEST: 'auth.cache-test',
} as const;
