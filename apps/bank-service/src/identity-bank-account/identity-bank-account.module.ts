import { Module } from '@nestjs/common';

import { IdentityBankAccountService } from './identity-bank-account.service';

import { BankAccountRepository } from './repository/bank-account.repository';
import { IdentityBankAccountKafkaController } from './identity-bank-account.kafka.controller';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from 'libs/cache/src';

@Module({
  imports: [CacheModule, JwtModule],
  controllers: [IdentityBankAccountKafkaController],
  providers: [IdentityBankAccountService, BankAccountRepository],
})
export class IdentityBankAccountModule {}
