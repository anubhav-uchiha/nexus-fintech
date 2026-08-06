import Joi, { required } from 'joi';

export const notificationValidationSchema = Joi.object({
  NODE_ENV: Joi.string().required(),
  APP_NAME: Joi.string().required(),
  APP_VERSION: Joi.string().required(),
  APP_PORT: Joi.number().required(),

  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENTS_ID: Joi.string().required(),
  KAFKA_GROUP_ID: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.string().required(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  BULLMQ_PREFIX: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),

  JWT_ACCESS_EXPIRES: Joi.string().required(),
  JWT_REFRESH_EXPIRES: Joi.string().required(),
});
