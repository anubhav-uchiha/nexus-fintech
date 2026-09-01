import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AuthServiceModule } from './app.module';
import { HttpToRpcExceptionInterceptor } from './common/interceptors/http-to-rpc-exception';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';
import { CacheService } from 'libs/cache/src';

const bootstrapLogger = new Logger('AuthServiceBootstrap');

function getPositiveInteger(
  value: string | number | undefined,
  fallback: number,
): number {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function getKafkaBrokers(configuredBrokers: string | undefined): string[] {
  const brokers = (configuredBrokers ?? '')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  return brokers.length > 0 ? brokers : ['localhost:9092'];
}

async function verifyRedisConnection(
  cacheService: CacheService,
): Promise<void> {
  const healthKey = `health:auth-service:${process.pid}:${Date.now()}`;

  const expectedValue = 'connected';

  try {
    await cacheService.set(healthKey, expectedValue, 10);

    const storedValue = await cacheService.get<string>(healthKey);

    if (storedValue !== expectedValue) {
      throw new Error('Redis health-check value did not match');
    }
  } finally {
    try {
      await cacheService.del(healthKey);
    } catch {
      // Do not hide the original Redis connection error.
    }
  }
}

async function bootstrap(): Promise<void> {
  bootstrapLogger.log('Creating Auth Service application');

  const app = await NestFactory.create(AuthServiceModule, {
    abortOnError: true,
  });

  const config = app.get(ConfigService);
  const cacheService = app.get(CacheService);

  const brokers = getKafkaBrokers(
    config.get<string>('KAFKA_BROKERS') ?? config.get<string>('KAFKA_BROKER'),
  );

  const kafkaConcurrency = getPositiveInteger(
    config.get<string | number>('AUTH_KAFKA_CONSUMER_CONCURRENCY'),
    4,
  );

  const kafkaConnectionTimeoutMs = getPositiveInteger(
    config.get<string | number>('AUTH_KAFKA_CONNECTION_TIMEOUT_MS'),
    10_000,
  );

  const kafkaRequestTimeoutMs = getPositiveInteger(
    config.get<string | number>('AUTH_KAFKA_REQUEST_TIMEOUT_MS'),
    30_000,
  );

  const kafkaRetryCount = getPositiveInteger(
    config.get<string | number>('AUTH_KAFKA_STARTUP_RETRY_COUNT'),
    8,
  );

  const kafkaInitialRetryTimeMs = getPositiveInteger(
    config.get<string | number>('AUTH_KAFKA_INITIAL_RETRY_TIME_MS'),
    300,
  );

  const port = getPositiveInteger(
    config.get<string | number>('AUTH_SERVICE_PORT'),
    6001,
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new HttpToRpcExceptionInterceptor());

  app.enableShutdownHooks();

  app.connectMicroservice<MicroserviceOptions>(
    {
      strategy: new AutoCreateTopicsServerKafka({
        client: {
          clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'auth-service',
          brokers,
          connectionTimeout: kafkaConnectionTimeoutMs,
          requestTimeout: kafkaRequestTimeoutMs,
          retry: {
            retries: kafkaRetryCount,
            initialRetryTime: kafkaInitialRetryTimeMs,
          },
        },
        consumer: {
          groupId: config.get<string>('KAFKA_GROUP_ID') ?? 'auth-service-group',
        },
        run: {
          partitionsConsumedConcurrently: kafkaConcurrency,
        },
      }),
    },
    {
      inheritAppConfig: true,
    },
  );

  bootstrapLogger.log('Verifying Redis connection');

  await verifyRedisConnection(cacheService);

  bootstrapLogger.log('✅ Redis connected successfully');

  bootstrapLogger.log(
    `Connecting Auth Service to Kafka at ${brokers.join(', ')}`,
  );

  await app.startAllMicroservices();

  bootstrapLogger.log('Auth Service Kafka consumer connected');

  await app.listen(port, '0.0.0.0');

  bootstrapLogger.log(`Auth Service HTTP server listening on 0.0.0.0:${port}`);

  bootstrapLogger.log(`Kafka consumer concurrency: ${kafkaConcurrency}`);
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? (error.stack ?? error.message)
      : 'Unknown Auth Service startup error';

  bootstrapLogger.error(message);

  process.exitCode = 1;
});
