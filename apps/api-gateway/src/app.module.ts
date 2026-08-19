import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from '@nexus/config';
import { LoggerModule } from '@nexus/logger';
import { envValidationSchema } from '@nexus/config';
import appConfig from '@nexus/config/configs/app.config';
import { AuthModule } from './auth/auth.module';
import { KycModule } from './kyc/kyc.module';
import { IdentityBankAccountModule } from './identity-bank-account/identity-bank-account.module';
import { EkoModule } from './aeps-service/providers/eko/eko.module';

import { S3Module } from './storage/s3/s3.module';
import { PrismaModule } from 'apps/kyc-service/src/database/prisma.module';
import { TransactionModule } from './transaction/transaction.module';
import { WalletModule } from './wallet/wallet.module';

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
    AuthModule,
    KycModule,
    IdentityBankAccountModule,
    EkoModule,
    TransactionModule,
    WalletModule,
    S3Module,
    PrismaModule,

  ],
})
export class AppModule {}
// export class AppModule implements OnModuleInit {
//   constructor(private readonly s3Service: S3Service) {}

//   async onModuleInit() {
//     try {
//       await this.s3Service.testConnection();
//       console.log('S3 connection successfully');
//     } catch (error) {
//       console.log('S3 conncetion failed:', error);
//     }
//   }
// }
