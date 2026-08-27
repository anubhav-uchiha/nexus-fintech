import { Module } from '@nestjs/common';
import { EkoService } from './eko.service';

@Module({
  providers: [EkoService],
})
export class EkoModule {}
