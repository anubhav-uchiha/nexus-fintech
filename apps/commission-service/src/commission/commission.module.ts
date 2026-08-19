import { Module } from '@nestjs/common';
import { CommissionKafkaController } from './commission.kafka.controller';
import { CommissionService } from './commission.service';
import { PrismaService } from '../database/prisma.service';
import { CommissionRuleService } from './commission-rule.service';
import { CommissionDistributionService } from './commission-distribution.service';
import { CommissionHierarchyService } from './commission-hierarchy.service';

@Module({
  controllers: [CommissionKafkaController],
  providers: [
    CommissionService,
    CommissionRuleService,
    CommissionDistributionService,
    CommissionHierarchyService,
    PrismaService,
  ],
  exports: [CommissionService],
})
export class CommissionModule {}
