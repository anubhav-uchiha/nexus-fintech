import { NestFactory } from '@nestjs/core';
import { KycServiceModule } from './kyc-service.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(KycServiceModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('app.kyc.port') ?? 6002;

  await app.listen(port);

  console.log(`✅ KYC Service Running on ${port}`);
}
bootstrap();
