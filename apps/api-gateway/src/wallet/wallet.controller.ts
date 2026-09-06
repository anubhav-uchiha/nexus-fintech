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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletGatewayController {
  constructor(private readonly walletService: WalletGatewayService) {}

  @Post('add-money')
  @ApiOperation({
    summary: 'Add money to wallet',
    description:
      'Adds money to a wallet using the supplied add-money request payload.',
  })
  @ApiCreatedResponse({
    description: 'Money added successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid add-money request',
  })
  async addMoney(@Body() dto: AddMoneyDto) {
    return this.walletService.addMoney(dto);
  }

  @Get('balances/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get wallet balances',
    description: 'Returns wallet balances for the authenticated user.',
  })
  @ApiParam({
    name: 'userId',
    type: String,
    required: true,
    description: 'User ID',
  })
  @ApiOkResponse({
    description: 'Wallet balances retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or the session is invalid',
  })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Transfer money to another account',
    description:
      'Transfers money from the authenticated identity wallet to another account.',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description:
      'Unique key used to prevent duplicate wallet transfer requests',
    schema: {
      type: 'string',
    },
  })
  @ApiCreatedResponse({
    description: 'Wallet transfer completed successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid transfer request or Idempotency-Key header is missing',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or the session is invalid',
  })
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
  @ApiOperation({
    summary: 'Calculate wallet commission',
    description:
      'Calculates the applicable commission for the supplied service, role, amount, and related commission parameters.',
  })
  @ApiCreatedResponse({
    description: 'Commission calculated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid commission calculation request',
  })
  async calculateCommission(@Body() dto: CalculateCommissionDto) {
    return this.walletService.calculateCommission(dto);
  }
}
