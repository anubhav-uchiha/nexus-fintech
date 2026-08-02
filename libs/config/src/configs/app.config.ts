import { registerAs } from '@nestjs/config';
import { CONFIG_NAMESPACE } from '../constants/config.constants';

export default registerAs(CONFIG_NAMESPACE.APP, () => ({
  name: process.env.APP_NAME,
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  otpVerificationRequired: process.env.OTP_VERIFICATION_REQUIRED === 'true',
  showOtpInResponse: process.env.SHOW_OTP_IN_RESPONSE === 'true',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),

  otpResendCooldownSeconds: Number(
    process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60,
  ),

  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),

  gateway: {
    port: Number(process.env.APP_PORT),
  },

  auth: {
    port: Number(process.env.AUTH_SERVICE_PORT),
  },
}));
