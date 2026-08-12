import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { WalletServiceModule } from './wallet-service.module';

async function bootstrap() {
  const app = await NestFactory.create(WalletServiceModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'wallet-service',

        brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
      },

      consumer: {
        groupId: config.get<string>('KAFKA_GROUP_ID') ?? 'wallet-service-group',
      },
    },
  });

  await app.startAllMicroservices();

  const port = config.get<number>('WALLET_SERVICE_PORT') ?? 6004;

  await app.listen(port);

  console.log(`✅ Wallet Service Running on ${port}`);

  console.log(`✅ Kafka Connected`);
}

bootstrap();
