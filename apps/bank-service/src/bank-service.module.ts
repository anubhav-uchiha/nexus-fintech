import { Module } from '@nestjs/common';
import { BankServiceController } from './bank-service.controller';
import { BankServiceService } from './bank-service.service';
import { IdentityBankAccountModule } from './identity-bank-account/identity-bank-account.module';
import { PrismaModule } from './database/prisma.module';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import appConfig from '@nexus/config/configs/app.config';
import { ConfigModule } from '@nestjs/config';

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
  ],
  controllers: [BankServiceController],
  providers: [BankServiceService],
})
export class BankServiceModule {}
