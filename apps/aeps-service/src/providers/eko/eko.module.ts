import { Module } from '@nestjs/common';
import { EkoController } from './eko.kafka.controller';
import { EkoService } from './eko.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [EkoController],
  providers: [EkoService],
})
export class EkoServiceModule {}
