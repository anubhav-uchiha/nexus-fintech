import { Module } from '@nestjs/common';
import { KycServiceController } from './kyc-service.controller';
import { KycServiceService } from './kyc-service.service';
import { AppConfigModule } from '@nexus/config';
import { KafkaModule } from 'libs/kafka/src';

@Module({
  imports: [AppConfigModule, KafkaModule],
  controllers: [KycServiceController],
  providers: [KycServiceService],
})
export class KycServiceModule {}
