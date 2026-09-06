import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { JwtPayload } from '../auth/intercaces/jwt-payload.interface';

import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

import { TransactionGatewayService } from './transaction.gateway.service';

import { ProviderTransactionQueryDto } from './dto/provider-transaction-query.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('AEPS - Transactions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Access token is missing, invalid, expired, or the session is invalid',
})
@Controller('aeps/transactions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class ProviderTransactionController {
  constructor(private readonly transactionService: TransactionGatewayService) {}

  /*
   * ==========================================
   * USER AEPS HISTORY
   * ==========================================
   */

  @Get()
  @ApiOperation({
    summary: 'Get my AEPS transaction history',
    description:
      'Returns AEPS provider transactions belonging to the authenticated identity. The service type is fixed to AEPS for this endpoint.',
  })
  @ApiOkResponse({
    description: 'AEPS transaction history retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction history query parameters',
  })
  list(
    @CurrentUser()
    user: JwtPayload,

    @Query()
    query: ProviderTransactionQueryDto,
  ) {
    return this.transactionService.listProviderTransactions(user.sub, {
      ...query,

      /*
       * This endpoint is only
       * for AEPS history.
       */
      serviceType: 'AEPS',
    });
  }

  /*
   * ==========================================
   * RECEIPT
   * ==========================================
   *
   * Keep this route before
   * :referenceId route.
   */

  @Get(':referenceId/receipt')
  @ApiOperation({
    summary: 'Get AEPS transaction receipt',
    description:
      'Returns the receipt for an AEPS provider transaction owned by the authenticated identity.',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'AEPS provider transaction reference ID',
  })
  @ApiOkResponse({
    description: 'AEPS transaction receipt retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'AEPS transaction or receipt not found',
  })
  receipt(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService.getProviderReceipt(referenceId, user.sub);
  }

  /*
   * ==========================================
   * DETAIL / STATUS POLLING
   * ==========================================
   */

  @Get(':referenceId')
  @ApiOperation({
    summary: 'Get AEPS transaction details',
    description:
      'Returns AEPS provider transaction details for the authenticated identity. This endpoint can also be used for transaction status polling.',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'AEPS provider transaction reference ID',
  })
  @ApiOkResponse({
    description: 'AEPS transaction details retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'AEPS transaction not found',
  })
  detail(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService.getProviderTransaction(
      referenceId,
      user.sub,
    );
  }
}
