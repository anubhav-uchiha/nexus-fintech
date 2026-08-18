import { NestFactory } from '@nestjs/core';
import { AepsServiceModule } from './aeps-service.module';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AepsServiceModule);
  const config = app.get(ConfigService);
  const brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'aeps-service',
        brokers,
      },
      consumer: {
        groupId: 'aeps-service-group',
      },
    },
  });

  await app.startAllMicroservices();

  const port = config.get<number>('APP_PORT') ?? 6003;

  await app.listen(port);

  console.log(`✅ AEPS Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}
bootstrap();
