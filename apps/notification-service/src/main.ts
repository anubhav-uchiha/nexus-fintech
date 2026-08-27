import { NotificationServiceModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);
  app.connectMicroservice({
    strategy: new AutoCreateTopicsServerKafka({
      client: {
        clientId: 'notification-service',
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'notification-consumer-group',
      },
    }),
  });
  await app.startAllMicroservices();
  await app.listen(6008);

  console.log('✅ Notification Service Running');
  console.log('✅ Kafka Consumer Started');
}
bootstrap();
