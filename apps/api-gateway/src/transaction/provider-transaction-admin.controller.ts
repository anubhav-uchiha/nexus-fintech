import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

import { PermissionGuard } from '../auth/guards/permission.guard';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { JwtPayload } from '../auth/intercaces/jwt-payload.interface';

import { RequirePermissions } from '../auth/decorator/require-permissions.decorator';

import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

import { TRANSACTION_PERMISSIONS } from '@nexus/common/transaction/transaction.permissions';

import {
  ProviderReconciliationQueryDto,
  ResolveProviderTransactionRequestDto,
} from './dto/provider-reconciliation.dto';

import { TransactionGatewayService } from './transaction.gateway.service';
import { RequestProviderTransactionReversalRequestDto } from './dto/RequestProviderTransactionReversalRequestDto';
import { isUUID } from 'class-validator';

@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class ProviderTransactionAdminController {
  constructor(private readonly transactionService: TransactionGatewayService) {}

  /*
   * ==========================================
   * RECONCILIATION QUEUE
   * ==========================================
   */

  @Get('reconciliation')
  //   @RequirePermissions(TRANSACTION_PERMISSIONS.RECONCILIATION_VIEW)
  getReconciliationQueue(
    @Query()
    query: ProviderReconciliationQueryDto,
  ) {
    return this.transactionService.listProviderReconciliationQueue(query);
  }

  /*
   * ==========================================
   * RESOLVE TRANSACTION
   * ==========================================
   */

  @Post('reconciliation/:referenceId/resolve')
  //   @RequirePermissions(TRANSACTION_PERMISSIONS.RECONCILIATION_RESOLVE)
  resolveProviderTransaction(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,

    @Body()
    dto: ResolveProviderTransactionRequestDto,
  ) {
    return this.transactionService.resolveProviderTransaction(
      referenceId,

      /*
       * Admin/operator identity.
       */
      user.sub,

      dto,
    );
  }

  @Post(':referenceId/reversal')
//   @RequirePermissions(TRANSACTION_PERMISSIONS.REVERSAL_REQUEST)
  requestReversal(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,

    @Headers('idempotency-key')
    idempotencyKey: string,

    @Body()
    dto: RequestProviderTransactionReversalRequestDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (!isUUID(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }

    return this.transactionService.requestProviderTransactionReversal(
      referenceId,

      user.sub,

      dto.reason,

      idempotencyKey,
    );
  }
}
