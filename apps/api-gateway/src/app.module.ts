import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from '@nexus/config';
import { LoggerModule } from '@nexus/logger';
import { envValidationSchema } from '@nexus/config';
import appConfig from '@nexus/config/configs/app.config';
import { AuthModule } from './auth/auth.module';
import { KycModule } from './kyc/kyc.module';
import { BankModule } from './bank/bank.module';
import { IdentityBankAccountModule } from './bank/identity-bank-account/identity-bank-account.module';

import { S3Module } from './storage/s3/s3.module';
import { PrismaModule } from 'apps/kyc-service/src/database/prisma.module';
import { TransactionModule } from './transaction/transaction.module';
import { WalletModule } from './wallet/wallet.module';
import { CommisisonRuleModule } from './commission-rule/commission-rule.module';
import { CommisisonDistributionModule } from './commission-distribution/commission-distribution.module';
import { CommisisonHierarchyModule } from './commission-hierarchy/commission-hierarchy.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { PackageModule } from './package/package.module';
import { VimopayAepsModule } from './aeps/vimopay/vimopay-aeps.module';
import { AuditModule } from './audit/audit.module';
import redisConfig from '@nexus/config/configs/redis.config';
import { CacheModule } from 'libs/cache/src';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';

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

      load: [appConfig, redisConfig],

      validationSchema: envValidationSchema,
    }),

    AppConfigModule,
    CacheModule,
    LoggerModule,
    AuthModule,
    KycModule,
    BankModule,
    IdentityBankAccountModule,
    TransactionModule,
    WalletModule,
    S3Module,
    PrismaModule,
    CommisisonRuleModule,
    CommisisonDistributionModule,
    CommisisonHierarchyModule,
    RoleModule,
    PermissionModule,
    PackageModule,
    VimopayAepsModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
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
