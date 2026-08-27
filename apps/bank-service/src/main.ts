import { NestFactory } from '@nestjs/core';
import { BankServiceModule } from './bank-service.module';
import { ConfigService } from '@nestjs/config';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';

async function bootstrap() {
  const app = await NestFactory.create(BankServiceModule);
  const config = app.get(ConfigService);

  app.connectMicroservice({
    strategy: new AutoCreateTopicsServerKafka({
      client: {
        clientId: 'bank-service',
        brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
      },
      consumer: {
        groupId: 'bank-service-group',
      },
    }),
  });

  await app.startAllMicroservices();

  const port = config.get<number>('APP_PORT') ?? 6007;

  await app.listen(port);

  console.log(`✅ BANK Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}
bootstrap();
