import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ValidationPipe } from '@nestjs/common';
import { ensureKafkaReplyTopics } from './kafka-topics';

function getKafkaBrokers(config: ConfigService): string[] {
  return (
    config.get<string>('KAFKA_BROKERS') ??
    config.get<string>('KAFKA_BROKER') ??
    'localhost:9092'
  )
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);

  const allowedOrigins = (
    config.get<string>('CORS_ORIGINS') ??
    'http://localhost:3000,http://localhost:5173,http://localhost:4200,http://192.168.1.11:8081,https://hoppscotch.io'
  )
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,

      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Idempotency-Key',
      'X-Request-Id',
    ],

    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // ClientKafka subscribes to reply topics in onModuleInit. Create every reply
  // topic before app.listen() triggers those hooks, so a fresh Kafka cluster can
  // boot without racing Kafka's asynchronous broker-side auto-creation.
  const replyTopicPartitions = Number.parseInt(
    config.get<string>('KAFKA_REPLY_TOPIC_PARTITIONS') ?? '1',
    10,
  );
  await ensureKafkaReplyTopics(getKafkaBrokers(config), replyTopicPartitions);

  const port = config.get<number>('app.gateway.port') ?? 8000;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 API Gateway running on http://localhost:${port}`);
}

bootstrap();
