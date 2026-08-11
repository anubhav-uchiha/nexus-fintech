import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import appConfig from '@nexus/config/configs/app.config';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import redisConfig from '@nexus/config/configs/redis.config';

import { KafkaModule } from 'libs/kafka/src';

import { PrismaModule } from './database/prisma.module';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: [
        `apps/transaction-service/.env.${process.env.NODE_ENV}`,
        'apps/transaction-service/.env',
      ],

      load: [appConfig, kafkaConfig, redisConfig],
    }),

    PrismaModule,
    KafkaModule,
    TransactionModule,
  ],
})
export class TransactionServiceModule {}
