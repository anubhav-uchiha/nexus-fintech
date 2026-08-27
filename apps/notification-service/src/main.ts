import { NotificationServiceModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpToRpcExceptionInterceptor } from '@nexus/common/interceptors/http-to-rpc-exception.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NotificationServiceModule);
  const logger = new Logger('NotificationService');
  const configService = app.get(ConfigService);
  const clientId =
    configService.get<string>('KAFKA_CLIENT_ID') ?? 'notification-service';
  const brokers = (
    configService.get<string>('KAFKA_BROKERS') ?? 'localhost:9092'
  )
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  const port = Number(
    configService.get<string | number>('NOTIFICATION_SERVICE_PORT') ?? 6008,
  );
  // app.connectMicroservice({
  //   strategy: new AutoCreateTopicsServerKafka({

  app.enableShutdownHooks();
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId,
        brokers,
      },
      consumer: {
        groupId: 'notification-consumer-group',
      },
    },
  });

  app.useGlobalInterceptors(new HttpToRpcExceptionInterceptor());
  await app.startAllMicroservices();
  await app.listen(port);

  logger.log(`Notification Service running on port ${port}`);

  logger.log('Notification Kafka consumer started');

  console.log(`✅ Notification Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}
bootstrap();
