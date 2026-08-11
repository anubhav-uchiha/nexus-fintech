import { Module } from '@nestjs/common';

import { IdentityBankAccountService } from './identity-bank-account.service';

import { IdentityModule } from '../identity/identity.module';
import { RoleModule } from '../role/role.module';
import { JwtModule } from '../auth/jwt/jwt.module';
import { SessionModule } from '../session/session.module';

import { BankAccountRepository } from './repository/bank-account.repository';
import { IdentityBankAccountKafkaController } from './identity-bank-account.kafka.controller';

@Module({
  imports: [
    IdentityModule,
    RoleModule,
    JwtModule,
    SessionModule,
  ],
  controllers: [IdentityBankAccountKafkaController],
  providers: [
    IdentityBankAccountService,
    BankAccountRepository,
  ],
})
export class IdentityBankAccountModule {}