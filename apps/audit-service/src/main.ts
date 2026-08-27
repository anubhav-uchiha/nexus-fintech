import { NestFactory } from '@nestjs/core';
import { AuditServiceModule } from './audit-service.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { HttpToRpcExceptionInterceptor } from '@nexus/common/interceptors/http-to-rpc-exception.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AuditServiceModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const brokers = (
    config.get<string>('KAFKA_BROKERS') ??
    config.get<string>('KAFKA_BROKER') ??
    'localhost:9092'
  )
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'audit-service',
          brokers,
        },
        consumer: {
          groupId:
            config.get<string>('KAFKA_GROUP_ID') ?? 'audit-service-group',
        },
      },
    },
    { inheritAppConfig: true },
  );

  app.useGlobalInterceptors(new HttpToRpcExceptionInterceptor());
  await app.startAllMicroservices();

  const port = config.get<number>('AUDIT_SERVICE_PORT') ?? 6009;
  await app.listen(port);

  console.log(`✅ Audit Service Running on ${port}`);
  console.log('✅ Audit Kafka Consumer Connected');
}
bootstrap();
