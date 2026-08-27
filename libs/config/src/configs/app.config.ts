import { registerAs } from '@nestjs/config';
import { CONFIG_NAMESPACE } from '../constants/config.constants';

export default registerAs(CONFIG_NAMESPACE.APP, () => ({
  name: process.env.APP_NAME,
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,

  otpVerificationRequired: process.env.OTP_VERIFICATION_REQUIRED === 'true',

  showOtpInResponse:
    process.env.NODE_ENV !== 'production' &&
    process.env.SHOW_OTP_IN_RESPONSE === 'true',

  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),

  otpResendCooldownSeconds: Number(
    process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60,
  ),

  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),

  loginMaxAttempts: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 5),

  loginIpMaxAttempts: Number(process.env.AUTH_LOGIN_IP_MAX_ATTEMPTS ?? 20),

  loginAttemptWindowSeconds: Number(
    process.env.AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS ?? 900,
  ),

  loginLockoutSeconds: Number(process.env.AUTH_LOGIN_LOCKOUT_SECONDS ?? 60),

  gateway: {
    port: Number(process.env.APP_PORT),
  },

  auth: {
    port: Number(process.env.AUTH_SERVICE_PORT),
  },
}));
