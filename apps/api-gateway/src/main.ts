import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);
  const port = config.get<number>('app.gateway.port') ?? 6000;

  await app.listen(port);

  console.log(`🚀 API Gateway running on http://localhost:${port}`);
}

bootstrap();
