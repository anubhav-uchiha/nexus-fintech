import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  app.connectMicroservice(
    {
      strategy: new AutoCreateTopicsServerKafka({
        client: {
          clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'auth-service',
          brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
        },
        consumer: {
          groupId: config.get<string>('KAFKA_GROUP_ID') ?? 'auth-service-group',
        },
      }),
    },
    {
      inheritAppConfig: true,
    },
  );

  await app.startAllMicroservices();

  const port = config.get<number>('AUTH_SERVICE_PORT') ?? 6001;

  await app.listen(port);

  console.log(`✅ Auth Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}

bootstrap();
