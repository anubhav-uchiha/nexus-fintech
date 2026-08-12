import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TransactionGatewayService } from './transaction.gateway.service';
import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionGatewayService) {}

  @Post()
  async createTransaction(@Body() dto: CreateTransactionDto) {
    return this.transactionService.createTransaction(dto);
  }

  @Get('balance/:walletType/:userId')
  async getBalance(
    @Param('walletType')
    walletType: 'MAIN' | 'AEPS' | 'PROFIT',

    @Param('userId')
    userId: string,
  ) {
    return this.transactionService.getBalance(userId, walletType);
  }

  @Get(':referenceId')
  async getTransactionByReference(
    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService.getTransactionByReference(referenceId);
  }
}
