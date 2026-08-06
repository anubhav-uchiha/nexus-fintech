import * as Joi from 'joi';

export const authValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  APP_NAME: Joi.string().required(),
  AUTH_SERVICE_PORT: Joi.number().required(),
  APP_VERSION: Joi.string().default('v1'),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),

  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),

  OTP_VERIFICATION_REQUIRED: Joi.boolean().default(false),
  SHOW_OTP_IN_RESPONSE: Joi.boolean().default(true),
  OTP_EXPIRY_MINUTES: Joi.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().default(60),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),

  SWAGGER_ENABLED: Joi.boolean().default(true),
});
