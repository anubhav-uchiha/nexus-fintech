import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './app.module';
import { ConfigService } from '@nestjs/config';
<<<<<<< Updated upstream
import { ValidationPipe } from '@nestjs/common';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';
=======
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { HttpToRpcExceptionInterceptor } from './common/interceptors/http-to-rpc-exception';
>>>>>>> Stashed changes

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

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AuthServiceModule);
  const config = app.get(ConfigService);
  const brokers = (
    config.get<string>('KAFKA_BROKERS') ??
    config.get<string>('KAFKA_BROKER') ??
    'localhost:9092'
  )
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  const kafkaConcurrency = getPositiveInteger(
    config.get<string | number>('AUTH_KAFKA_CONSUMER_CONCURRENCY'),
    4,
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
        },
        consumer: {
          groupId: config.get<string>('KAFKA_GROUP_ID') ?? 'auth-service-group',
        },
<<<<<<< Updated upstream
      }),
=======
        run: {
          partitionsConsumedConcurrently: kafkaConcurrency,
        },
      },
>>>>>>> Stashed changes
    },
    {
      inheritAppConfig: true,
    },
  );

  await app.startAllMicroservices();

  const port = config.get<number>('AUTH_SERVICE_PORT') ?? 6001;

  await app.listen(port, '0.0.0.0');
  const logger = new Logger('AuthService');

  console.log(`✅ Auth Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
  logger.log(`Auth Service running on ${port}`);
  logger.log(`Kafka connected with consumer concurrency ${kafkaConcurrency}`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('AuthServiceBootstrap');

  logger.error(
    error instanceof Error ? error.stack : 'Unknown Auth Service startup error',
  );
  process.exitCode = 1;
});
