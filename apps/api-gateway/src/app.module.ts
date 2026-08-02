import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from '@nexus/config';
import { LoggerModule } from '@nexus/logger';
import { envValidationSchema } from '@nexus/config';
import appConfig from '@nexus/config/configs/app.config';

import { AuthModule } from './auth/auth.module';
import { KafkaModule } from 'libs/kafka/src';

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
  ],
})
export class AppModule {}
