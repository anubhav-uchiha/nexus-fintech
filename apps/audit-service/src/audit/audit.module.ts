import { Module } from '@nestjs/common';
import { AuditKafkaController } from './audit.kafka.controller';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditKafkaController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
