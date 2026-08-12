import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from '@nexus/config/configs/app.config';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import { PrismaModule } from './database/prisma.module';
import { EkoModule } from 'apps/api-gateway/src/aeps-service/providers/eko/eko.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `apps/auth-service/.env.${process.env.NODE_ENV}`,
        'apps/auth-service/.env',
      ],
      load: [appConfig, kafkaConfig],
    }),
    PrismaModule,
    EkoModule,
  ],
})
export class AepsServiceModule {}
