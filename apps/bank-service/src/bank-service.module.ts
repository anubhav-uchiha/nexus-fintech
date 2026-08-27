import { Module } from '@nestjs/common';
import { BankServiceController } from './bank-service.controller';
import { BankServiceService } from './bank-service.service';
import { IdentityBankAccountModule } from './identity-bank-account/identity-bank-account.module';
import { PrismaModule } from './database/prisma.module';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import appConfig from '@nexus/config/configs/app.config';
import { ConfigModule } from '@nestjs/config';
import { BanksModule } from './banks/banks.module';
import { BankVerificationModule } from './bank-verification/bank-verification.module';
import { EkoModule } from './bank-verification/providers/eko/eko.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `apps/bank-service/.env.${process.env.NODE_ENV}`,
        'apps/bank-service/.env',
      ],
      load: [appConfig, kafkaConfig],
    }),
    PrismaModule,
    IdentityBankAccountModule,
    BanksModule,
    BankVerificationModule,
    EkoModule,
  ],
  controllers: [BankServiceController],
  providers: [BankServiceService],
})
export class BankServiceModule {}
