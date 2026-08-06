import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { KycRepository } from './kyc/repository/kyc.repository';
import { ConfigModule } from '@nestjs/config';
import appConfig from '@nexus/config/configs/app.config';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import { KycModule } from './kyc/kyc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `apps/kyc-service/.env.${process.env.NODE_ENV ?? 'developmenet'}`,
        'apps/kyc-service/.env',
      ],
      load: [appConfig, kafkaConfig],
    }),
    PrismaModule,
    KycModule,
  ],
  providers: [KycRepository],
})
export class KycServiceModule {}
