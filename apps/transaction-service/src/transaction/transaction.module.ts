import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionKafkaController } from './transaction.kafka.controller';

@Module({
  controllers: [TransactionKafkaController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
