import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { TransactionGatewayService } from './transaction.gateway.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { JwtPayload } from '../auth/intercaces/jwt-payload.interface';

import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class TransactionController {
  constructor(private readonly transactionService: TransactionGatewayService) {}

  /*
   * ==========================================
   * CURRENT USER WALLET BALANCE
   * ==========================================
   *
   * User ID URL se accept nahi karenge.
   *
   * Authenticated JWT identity authoritative.
   */

  @Get('balance/:walletType')
  getMyBalance(
    @CurrentUser()
    user: JwtPayload,

    @Param('walletType')
    walletType: 'MAIN' | 'AEPS' | 'PROFIT',
  ) {
    return this.transactionService.getBalance(user.sub, walletType);
  }
}
