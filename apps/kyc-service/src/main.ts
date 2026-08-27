import { NestFactory } from '@nestjs/core';
import { KycServiceModule } from './kyc-service.module';
import { ConfigService } from '@nestjs/config';
import { AutoCreateTopicsServerKafka } from 'libs/kafka/src';
import { HttpToRpcExceptionInterceptor } from '@nexus/common/interceptors/http-to-rpc-exception.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(KycServiceModule);
  const config = app.get(ConfigService);

  app.connectMicroservice({
    strategy: new AutoCreateTopicsServerKafka({
      client: {
        clientId: 'kyc-service',
        brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
      },
      consumer: {
        groupId: 'kyc-service-group',
      },
    }),
  });

  app.useGlobalInterceptors(new HttpToRpcExceptionInterceptor());

  await app.startAllMicroservices();

  const port = config.get<number>('KYC_SERVICE_PORT') ?? 6002;

  await app.listen(port);

  console.log(`✅ KYC Service Running on ${port}`);
  console.log(`✅ Kafka Connected`);
}
bootstrap();
