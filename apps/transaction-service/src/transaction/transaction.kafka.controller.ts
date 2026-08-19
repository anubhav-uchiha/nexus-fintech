import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { TransactionService } from './transaction.service';
import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';
import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';
import { CreateCommissionTransactionDto } from '@nexus/common/transaction/dto/create-commission-transaction.dto';

@Controller()
export class TransactionKafkaController {
  constructor(private readonly transactionService: TransactionService) {}

  @MessagePattern(TRANSACTION_PATTERNS.CREATE)
  async createTransaction(@Payload() dto: CreateTransactionDto) {
    return this.transactionService.createTransaction(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.GET_BY_REFERENCE)
  async getTransactionByReference(
    @Payload()
    payload: {
      referenceId: string;
    },
  ) {
    return this.transactionService.getTransactionByReference(
      payload.referenceId,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.GET_BALANCE)
  async getCurrentBalance(
    @Payload()
    payload: {
      userId: string;
      walletType: 'MAIN' | 'AEPS' | 'PROFIT';
    },
  ) {
    return this.transactionService.getCurrentBalance(
      payload.userId,
      payload.walletType,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.TRANSFER)
  async transferMoney(@Payload() dto: TransferMoneyDto) {
    return this.transactionService.transferMoney(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.CREATE_COMMISSION)
  async createCommissionTransaction(
    @Payload() dto: CreateCommissionTransactionDto,
  ) {
    return this.transactionService.createCommissionTransaction(dto);
  }
}
