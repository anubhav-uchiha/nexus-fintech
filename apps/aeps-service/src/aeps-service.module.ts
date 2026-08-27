import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import appConfig from '@nexus/config/configs/app.config';

import kafkaConfig from '@nexus/config/configs/kafka.config';

import { PrismaModule } from './database/prisma.module';

import { VimopayModule } from './providers/vimopay/vimopay.module';

import { VimopayOnboardingModule } from './providers/vimopay/onboarding/vimopay-onboarding.module';
import { VimopayTransactionModule } from './providers/vimopay/transaction/vimopay-transaction.module';
import { VimopayTransportModule } from './providers/vimopay/transport/vimopay-transport.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: [
        `apps/aeps-service/.env.${process.env.NODE_ENV}`,
        'apps/aeps-service/.env',
      ],

      load: [appConfig, kafkaConfig],
    }),

    PrismaModule,

    /*
     * Low-level provider APIs.
     */
    VimopayModule,

    /*
     * Provider-specific onboarding.
     */
    VimopayOnboardingModule,
    VimopayTransactionModule,
    VimopayTransportModule,
  ],
})
export class AepsServiceModule {}
