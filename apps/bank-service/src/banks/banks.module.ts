import { Module } from '@nestjs/common';
import { EkoService } from './providers/eko/eko.service';
import { EkoModule } from '../bank-verification/providers/eko/eko.module';

@Module({
  imports: [EkoModule],
  providers: [EkoService],
  exports: [EkoService],
})
export class BanksModule {}
