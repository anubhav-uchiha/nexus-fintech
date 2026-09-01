import { Module } from '@nestjs/common';
import { KycKafkaController } from './kyc.kafka.controller';
import { KycService } from './kyc.service';
import { KycRepository } from './repository/kyc.repository';
import { PrismaModule } from '../database/prisma.module';
import { KafkaModule } from 'libs/kafka/src';

@Module({
  imports: [PrismaModule, KafkaModule],
  controllers: [KycKafkaController],
  providers: [KycService, KycRepository],
})
export class KycModule {}
