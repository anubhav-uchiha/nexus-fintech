import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { WalletGatewayService } from './wallet.service';
import { AddMoneyDto } from '@nexus/common/transaction/dto/add-money.dto';

import { CalculateCommissionDto } from '@nexus/common/commission/dto/calculate-commission.dto';
import { PeerTransferRequestDto } from '@nexus/common/transaction/dto/transfer-money.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

@Controller('wallet')
export class WalletGatewayController {
  constructor(private readonly walletService: WalletGatewayService) {}

  @Post('add-money')
  async addMoney(@Body() dto: AddMoneyDto) {
    return this.walletService.addMoney(dto);
  }
  @Get('balances/:userId')
  @UseGuards(JwtAuthGuard)
  async getBalances(
    @Req()
    request: {
      user: {
        sub: string;
      };
    },
  ) {
    return this.walletService.getBalances(request.user.sub);
  }

  @Post('transfer')
  @UseGuards(JwtAuthGuard)
  async transferMoney(
    @Body() dto: PeerTransferRequestDto,

    @Headers('idempotency-key')
    idempotencyKey: string | undefined,

    @Req()
    request: {
      user: {
        sub: string;
      };
    },
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return this.walletService.transferMoney(
      dto,
      request.user.sub,
      idempotencyKey.trim(),
    );
  }

  @Post('calculate-commission')
  async calculateCommission(@Body() dto: CalculateCommissionDto) {
    return this.walletService.calculateCommission(dto);
  }
}
