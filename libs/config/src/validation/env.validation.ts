import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  APP_NAME: Joi.string().required(),

  APP_PORT: Joi.number().default(3000),

  APP_VERSION: Joi.string().default('v1'),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),

  JWT_REFRESH_SECRET: Joi.string().min(32).required(),

  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),

  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),

  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),

  REDIS_PORT: Joi.number().default(6379),

  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // Kafka
  KAFKA_BROKERS: Joi.string().required(),

  KAFKA_CLIENT_ID: Joi.string().required(),

  KAFKA_GROUP_ID: Joi.string().required(),

  // BullMQ
  BULLMQ_PREFIX: Joi.string().default('nexus'),

  // Swagger
  SWAGGER_ENABLED: Joi.boolean().default(true),

  OTP_VERIFICATION_REQUIRED: Joi.boolean().default(false),

  SHOW_OTP_IN_RESPONSE: Joi.boolean().default(true),

  OTP_EXPIRY_MINUTES: Joi.number().default(5),

  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().default(60),

  OTP_MAX_ATTEMPTS: Joi.number().default(5),
});
