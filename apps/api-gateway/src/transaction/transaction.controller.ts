import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TransactionGatewayService } from './transaction.gateway.service';
import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';
import { JwtPayload } from '../auth/intercaces/jwt-payload.interface';
import { ProviderTransactionQueryDto } from './dto/provider-transaction-query.dto';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import {
  ProviderReconciliationQueryDto,
  ResolveProviderTransactionRequestDto,
} from './dto/provider-reconciliation.dto';

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

  @Get('provider-transactions')
  getProviderTransactions(
    @CurrentUser()
    user: JwtPayload,

    @Query()
    query: ProviderTransactionQueryDto,
  ) {
    return this.transactionService.listProviderTransactions(user.sub, query);
  }

  // @Get('provider-transactions/:referenceId')
  // getProviderTransaction(
  //   @CurrentUser()
  //   user: JwtPayload,

  //   @Param('referenceId')
  //   referenceId: string,
  // ) {
  //   return this.transactionService.getProviderTransaction(
  //     user.sub,
  //     referenceId,
  //   );
  // }

  // @Get('transactions/reconciliation')
  // getReconciliationQueue(
  //   @Query()
  //   query: ProviderReconciliationQueryDto,
  // ) {
  //   return this.transactionService.listProviderReconciliationQueue(query);
  // }

  // @Post('transactions/reconciliation/:referenceId/resolve')
  // resolveProviderTransaction(
  //   @CurrentUser()
  //   user: JwtPayload,

  //   @Param('referenceId')
  //   referenceId: string,

  //   @Body()
  //   dto: ResolveProviderTransactionRequestDto,
  // ) {
  //   return this.transactionService.resolveProviderTransaction(
  //     referenceId,

  //     user.sub,

  //     dto,
  //   );
  // }
}
