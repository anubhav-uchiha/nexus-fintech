import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import appConfig from '@nexus/config/configs/app.config';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import redisConfig from '@nexus/config/configs/redis.config';

import { KafkaModule } from 'libs/kafka/src';
import { PrismaModule } from './database/prisma.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: [
        `apps/wallet-service/.env.${process.env.NODE_ENV}`,
        'apps/wallet-service/.env',
      ],

      load: [appConfig, kafkaConfig, redisConfig],
    }),

    PrismaModule,
    KafkaModule,
    WalletModule,
  ],
})
export class WalletServiceModule {}
