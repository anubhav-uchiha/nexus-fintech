import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { CommissionServiceModule } from './commission-service.module';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';

async function bootstrap() {
  const app = await NestFactory.create(CommissionServiceModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  app.connectMicroservice({
    strategy: new AutoCreateTopicsServerKafka({
      client: {
        clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'commission-service',

        brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
      },

      consumer: {
        groupId:
          config.get<string>('KAFKA_GROUP_ID') ?? 'commission-service-group',
      },
    }),
  });

  await app.startAllMicroservices();

  const port = config.get<number>('COMMISSION_SERVICE_PORT') ?? 6006;

  await app.listen(port);

  console.log(`✅ Commission Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}

bootstrap();
