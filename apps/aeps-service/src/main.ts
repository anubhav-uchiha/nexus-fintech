import { NestFactory } from '@nestjs/core';
import { AepsServiceModule } from './aeps-service.module';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AepsServiceModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = app.get(ConfigService);
  const brokerConfig =
    config.get<string>('KAFKA_BROKERS') ??
    config.get<string>('KAFKA_BROKER') ??
    'localhost:9092';
  const brokers = brokerConfig
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  app.connectMicroservice(
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'aeps-service',
          brokers,
        },
        consumer: {
          groupId: config.get<string>('KAFKA_GROUP_ID') ?? 'aeps-service-group',
        },
      },
    },
    {
      inheritAppConfig: true,
    },
  );

  await app.startAllMicroservices();

  const port = config.get<number>('AEPS_SERVICE_PORT') ?? 6003;

  await app.listen(port);

  console.log(`✅ AEPS Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}
bootstrap();
