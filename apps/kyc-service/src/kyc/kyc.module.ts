import { Module } from '@nestjs/common';
import { KycKafkaController } from './kyc.kafka.controller';
import { KycService } from './kyc.service';
import { KycRepository } from './repository/kyc.repository';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KycKafkaController],
  providers: [KycService, KycRepository],
})
export class KycModule {}
