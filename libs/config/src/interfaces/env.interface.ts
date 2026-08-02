export interface EnvironmentVariables {
  NODE_ENV: string;

  APP_NAME: string;

  APP_PORT: number;

  APP_VERSION: string;

  JWT_ACCESS_SECRET: string;

  JWT_REFRESH_SECRET: string;

  JWT_ACCESS_EXPIRES: string;

  JWT_REFRESH_EXPIRES: string;

  DATABASE_URL: string;

  REDIS_HOST: string;

  REDIS_PORT: number;

  REDIS_PASSWORD?: string;

  KAFKA_BROKERS: string;

  KAFKA_CLIENT_ID: string;

  KAFKA_GROUP_ID: string;

  BULLMQ_PREFIX: string;

  SWAGGER_ENABLED: boolean;

  OTP_VERIFICATION_REQUIRED: boolean;

  SHOW_OTP_IN_RESPONSE: boolean;

  OTP_EXPIRY_MINUTES: number;

  OTP_RESEND_COOLDOWN_SECONDS: number;

  OTP_MAX_ATTEMPTS: number;
}
