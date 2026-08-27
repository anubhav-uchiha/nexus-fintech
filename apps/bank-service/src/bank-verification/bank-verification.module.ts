import { Module } from '@nestjs/common';
import { BankVerificationService } from './bank-verification.service';
import { EkoService } from './providers/eko/eko.service';
import { EkoModule } from './providers/eko/eko.module';

@Module({
  providers: [BankVerificationService, EkoService],
  imports: [EkoModule],
  exports: [BankVerificationService],
})
export class BankVerificationModule {}
