import { NestFactory } from '@nestjs/core';
import { AepsServiceModule } from './aeps-service.module';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AepsServiceModule);
  const config = app.get(ConfigService);

  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'aeps-service',
        brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
      },
      consumer: {
        groupId: 'aeps-service-group',
      },
    },
  });

  await app.startAllMicroservices();

  const port = config.get<number>('KYC_SERVICE_PORT') ?? 6003;

  await app.listen(port);

  console.log(`✅ AEPS Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}
bootstrap();
