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

import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

import { PermissionGuard } from '../auth/guards/permission.guard';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { JwtPayload } from '../auth/intercaces/jwt-payload.interface';

import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

import {
  ProviderReconciliationQueryDto,
  ResolveProviderTransactionRequestDto,
} from './dto/provider-reconciliation.dto';

import { TransactionGatewayService } from './transaction.gateway.service';

import { RequestProviderTransactionReversalRequestDto } from './dto/RequestProviderTransactionReversalRequestDto';

import { ProviderIncomeReconciliationRequestDto } from './dto/provider-income-reconciliation.dto';
import { AdminProviderTransactionQueryDto } from './dto/admin-provider-transaction-query.dto';
import { ProviderReversalQueryDto } from './dto/provider-reversal-query.dto';

@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class ProviderTransactionAdminController {
  constructor(private readonly transactionService: TransactionGatewayService) {}

  /*
   * TODO BEFORE PRODUCTION:
   *
   * Restore all @RequirePermissions(...)
   * decorators.
   *
   * Currently disabled only because
   * UAT testing uses Retailer login.
   */

  /*
   * ==========================================
   * ALL PROVIDER TRANSACTIONS
   * ==========================================
   */

  @Get('provider')
  getProviderTransactions(
    @Query()
    query: AdminProviderTransactionQueryDto,
  ) {
    return this.transactionService.adminListProviderTransactions(query);
  }

  /*
   * ==========================================
   * PENDING PROVIDER INCOME
   * ==========================================
   */

  @Get('provider-income/pending')
  getPendingProviderIncome(
    @Query()
    query: AdminProviderTransactionQueryDto,
  ) {
    return this.transactionService.listPendingProviderIncome(query);
  }

  /*
   * ==========================================
   * PROVIDER INCOME RECONCILE
   * ==========================================
   *
   * Cleaner admin path.
   *
   * Old:
   * /aeps/vimopay/admin/provider-income/...
   *
   * can remain temporarily for
   * backward compatibility.
   */

  @Post(':referenceId/provider-income/reconcile')
  reconcileProviderIncome(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,

    @Body()
    dto: ProviderIncomeReconciliationRequestDto,
  ) {
    return this.transactionService.reconcileVimopayProviderIncome({
      referenceId,

      reconciledBy: user.sub,

      ...dto,
    });
  }

  /*
   * ==========================================
   * RECONCILIATION QUEUE
   * ==========================================
   */

  @Get('reconciliation')
  // @RequirePermissions(
  //   TRANSACTION_PERMISSIONS.RECONCILIATION_VIEW,
  // )
  getReconciliationQueue(
    @Query()
    query: ProviderReconciliationQueryDto,
  ) {
    return this.transactionService.listProviderReconciliationQueue(query);
  }

  /*
   * ==========================================
   * RESOLVE PROVIDER TRANSACTION
   * ==========================================
   */

  @Post('reconciliation/:referenceId/resolve')
  // @RequirePermissions(
  //   TRANSACTION_PERMISSIONS.RECONCILIATION_RESOLVE,
  // )
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

      user.sub,

      dto,
    );
  }

  /*
   * ==========================================
   * FINANCIAL RECOVERY
   * ==========================================
   */

  @Post('reconciliation/:referenceId/recover-financial-effects')
  recoverFinancialEffects(
    @CurrentUser()
    user: JwtPayload,

    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService.recoverProviderFinancialEffects(
      referenceId,

      user.sub,
    );
  }

  /*
   * ==========================================
   * REQUEST REVERSAL
   * ==========================================
   */

  @Post(':referenceId/reversal')
  // @RequirePermissions(
  //   TRANSACTION_PERMISSIONS.REVERSAL_REQUEST,
  // )
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

  /*
   * ==========================================
   * REVERSALS LIST
   * ==========================================
   */

  @Get('reversals')
  getReversals(
    @Query()
    query: ProviderReversalQueryDto,
  ) {
    return this.transactionService.listProviderReversals(query);
  }

  /*
   * ==========================================
   * REVERSAL DETAIL
   * ==========================================
   */

  @Get('reversals/:reversalReferenceId')
  getReversal(
    @Param('reversalReferenceId')
    reversalReferenceId: string,
  ) {
    return this.transactionService.getProviderReversal(reversalReferenceId);
  }

  /*
   * ==========================================
   * PROCESS / RETRY REVERSAL
   * ==========================================
   */

  @Post('reversals/:reversalReferenceId/process')
  // @RequirePermissions(
  //   TRANSACTION_PERMISSIONS.REVERSAL_PROCESS,
  // )
  processReversal(
    @CurrentUser()
    user: JwtPayload,

    @Param('reversalReferenceId')
    reversalReferenceId: string,
  ) {
    return this.transactionService.processProviderTransactionReversal(
      reversalReferenceId,

      user.sub,
    );
  }

  /*
   * ==========================================
   * PROVIDER TRANSACTION DETAIL
   * ==========================================
   */

  @Get('provider/:referenceId')
  getProviderTransactionAdmin(
    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService.getProviderTransaction(referenceId);
  }
}
