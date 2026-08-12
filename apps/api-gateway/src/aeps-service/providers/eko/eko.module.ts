import { Module } from '@nestjs/common';
import { EkoService } from './eko.service';
import { EkoController } from './eko.controller';

@Module({
  providers: [EkoService],
  controllers: [EkoController]
})
export class EkoModule {}
