import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth-guard';

import {
  CurrentUser,
} from '../auth/decorator/current-user.decorator';

import {
  JwtPayload,
} from '../auth/intercaces/jwt-payload.interface';

import {
  RpcToHttpExceptionInterceptor,
} from '../common/interceptors/rpc-to-http-exception';

import {
  TransactionGatewayService,
} from './transaction.gateway.service';

import {
  ProviderTransactionQueryDto,
} from './dto/provider-transaction-query.dto';

@Controller('aeps/transactions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(
  RpcToHttpExceptionInterceptor,
)
export class ProviderTransactionController {
  constructor(
    private readonly transactionService:
      TransactionGatewayService,
  ) {}

  /*
   * ==========================================
   * USER AEPS HISTORY
   * ==========================================
   */

  @Get()
  list(
    @CurrentUser()
    user: JwtPayload,

    @Query()
    query:
      ProviderTransactionQueryDto,
  ) {
    return this.transactionService
      .listProviderTransactions(
        user.sub,
        {
          ...query,

          /*
           * This endpoint is only
           * for AEPS history.
           */
          serviceType:
            'AEPS',
        },
      );
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
  receipt(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService
      .getProviderReceipt(
        referenceId,
        user.sub,
      );
  }

  /*
   * ==========================================
   * DETAIL / STATUS POLLING
   * ==========================================
   */

  @Get(':referenceId')
  detail(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService
      .getProviderTransaction(
        referenceId,
        user.sub,
      );
  }
}