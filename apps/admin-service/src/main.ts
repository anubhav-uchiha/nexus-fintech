import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AdminServiceModule } from './admin-service.module';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';
import { HttpToRpcExceptionInterceptor } from '@nexus/common/interceptors/http-to-rpc-exception.interceptor';

const bootstrapLogger = new Logger('AdminServiceBootstrap');

function getPositiveInteger(
  value: string | number | undefined,
  fallback: number,
): number {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function getKafkaBrokers(configuredBrokers: string | undefined): string[] {
  const brokers = (configuredBrokers ?? '')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  return brokers.length > 0 ? brokers : ['localhost:9092'];
}

async function bootstrap(): Promise<void> {
  bootstrapLogger.log('Creating Admin Service application');

  const app = await NestFactory.create(AdminServiceModule, {
    abortOnError: true,
  });

  const config = app.get(ConfigService);

  const brokers = getKafkaBrokers(
    config.get<string>('KAFKA_BROKERS') ?? config.get<string>('KAFKA_BROKER'),
  );

  const port = getPositiveInteger(
    config.get<string | number>('ADMIN_SERVICE_PORT'),
    6010,
  );

  const kafkaConcurrency = getPositiveInteger(
    config.get<string | number>('ADMIN_KAFKA_CONSUMER_CONCURRENCY'),
    4,
  );

  const kafkaConnectionTimeoutMs = getPositiveInteger(
    config.get<string | number>('ADMIN_KAFKA_CONNECTION_TIMEOUT_MS'),
    10_000,
  );

  const kafkaRequestTimeoutMs = getPositiveInteger(
    config.get<string | number>('ADMIN_KAFKA_REQUEST_TIMEOUT_MS'),
    30_000,
  );

  const kafkaRetryCount = getPositiveInteger(
    config.get<string | number>('ADMIN_KAFKA_STARTUP_RETRY_COUNT'),
    8,
  );

  const kafkaInitialRetryTimeMs = getPositiveInteger(
    config.get<string | number>('ADMIN_KAFKA_INITIAL_RETRY_TIME_MS'),
    300,
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
          clientId:
            config.get<string>('ADMIN_KAFKA_CLIENT_ID') ?? 'admin-service',
          brokers,
          connectionTimeout: kafkaConnectionTimeoutMs,
          requestTimeout: kafkaRequestTimeoutMs,
          retry: {
            retries: kafkaRetryCount,
            initialRetryTime: kafkaInitialRetryTimeMs,
          },
        },
        consumer: {
          groupId:
            config.get<string>('ADMIN_KAFKA_GROUP_ID') ?? 'admin-service-group',
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

  bootstrapLogger.log(
    `Connecting Admin Service to Kafka at ${brokers.join(', ')}`,
  );

  await app.startAllMicroservices();

  bootstrapLogger.log('Admin Service Kafka consumer connected');

  await app.listen(port, '0.0.0.0');

  bootstrapLogger.log(`Admin Service HTTP server listening on 0.0.0.0:${port}`);
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? (error.stack ?? error.message)
      : 'Unknown Admin Service startup error';

  bootstrapLogger.error(message);
  process.exitCode = 1;
});
