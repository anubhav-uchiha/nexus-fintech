import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from '@nexus/config';
import { LoggerModule } from '@nexus/logger';
import { envValidationSchema } from '@nexus/config';
import appConfig from '@nexus/config/configs/app.config';

import { AuthModule } from './auth/auth.module';
import { KafkaModule } from 'libs/kafka/src';
import { KycModule } from './kyc/kyc.module';
import { IdentityBankAccountModule } from './identity-bank-account/identity-bank-account.module';
import { EkoModule } from './aeps-service/providers/eko/eko.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,

      envFilePath: [
        `apps/api-gateway/.env.${process.env.NODE_ENV ?? 'development'}`,
        'apps/api-gateway/.env',
      ],

      load: [appConfig],

      validationSchema: envValidationSchema,
    }),

    AppConfigModule,
    LoggerModule,
    // KafkaModule,
    AuthModule,
    KycModule,
    IdentityBankAccountModule,
    EkoModule
  ],
})
export class AppModule {}
