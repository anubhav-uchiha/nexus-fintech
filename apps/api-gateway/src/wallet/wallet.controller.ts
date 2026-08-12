import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { WalletGatewayService } from './wallet.service';
import { AddMoneyDto } from '@nexus/common/transaction/dto/add-money.dto';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';

@Controller('wallet')
export class WalletGatewayController {
  constructor(private readonly walletService: WalletGatewayService) {}

  @Post('add-money')
  async addMoney(@Body() dto: AddMoneyDto) {
    return this.walletService.addMoney(dto);
  }
  @Get('balances/:userId')
  async getBalances(@Param('userId') userId: string) {
    return this.walletService.getBalances(userId);
  }

  @Post('transfer')
  async transferMoney(@Body() dto: TransferMoneyDto) {
    return this.walletService.transferMoney(dto);
  }
}
