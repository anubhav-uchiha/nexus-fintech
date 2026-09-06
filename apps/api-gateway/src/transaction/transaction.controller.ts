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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Access token is missing, invalid, expired, or the session is invalid',
})
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
  @ApiOperation({
    summary: 'Get my wallet balance',
    description:
      'Returns the balance of the selected wallet for the currently authenticated identity.',
  })
  @ApiParam({
    name: 'walletType',
    required: true,
    enum: ['MAIN', 'AEPS', 'PROFIT'],
    description: 'Wallet type',
  })
  @ApiOkResponse({
    description: 'Wallet balance retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet type',
  })
  getMyBalance(
    @CurrentUser()
    user: JwtPayload,

    @Param('walletType')
    walletType: 'MAIN' | 'AEPS' | 'PROFIT',
  ) {
    return this.transactionService.getBalance(user.sub, walletType);
  }
}
