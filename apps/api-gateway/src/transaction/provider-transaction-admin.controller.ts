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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Admin - Provider Transactions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Access token is missing, invalid, expired, or the session is invalid',
})
@ApiForbiddenResponse({
  description:
    'Authenticated account does not have permission to access this operation',
})
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
  @ApiOperation({
    summary: 'Get all provider transactions',
    description:
      'Returns provider transactions using the supplied admin filters and pagination.',
  })
  @ApiOkResponse({
    description: 'Provider transactions retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid provider transaction query parameters',
  })
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
  @ApiOperation({
    summary: 'Get pending provider income',
    description:
      'Returns provider transactions whose provider-income reconciliation is still pending.',
  })
  @ApiOkResponse({
    description: 'Pending provider income retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid provider-income query parameters',
  })
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
  @ApiOperation({
    summary: 'Reconcile provider income',
    description:
      'Reconciles provider income for a specific provider transaction reference.',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'Provider transaction reference ID',
  })
  @ApiOkResponse({
    description: 'Provider income reconciled successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid provider income reconciliation payload',
  })
  @ApiNotFoundResponse({
    description: 'Provider transaction or provider income record not found',
  })
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
  @ApiOperation({
    summary: 'Get provider reconciliation queue',
    description:
      'Returns provider transactions that require reconciliation review.',
  })
  @ApiOkResponse({
    description: 'Provider reconciliation queue retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid reconciliation query parameters',
  })
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
  @ApiOperation({
    summary: 'Resolve provider transaction reconciliation',
    description:
      'Manually resolves a provider transaction that is currently in the reconciliation queue.',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'Provider transaction reference ID',
  })
  @ApiOkResponse({
    description: 'Provider transaction resolved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid provider reconciliation resolution payload',
  })
  @ApiNotFoundResponse({
    description: 'Provider transaction not found',
  })
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
  @ApiOperation({
    summary: 'Recover provider transaction financial effects',
    description:
      'Retries or recovers financial effects for a reconciled provider transaction.',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'Provider transaction reference ID',
  })
  @ApiOkResponse({
    description: 'Financial effects recovered successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Financial recovery cannot be performed for the current transaction state',
  })
  @ApiNotFoundResponse({
    description: 'Provider transaction not found',
  })
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
  @ApiOperation({
    summary: 'Request provider transaction reversal',
    description: 'Creates a reversal request for a provider transaction.',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'Provider transaction reference ID',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description: 'Unique UUID used to prevent duplicate reversal requests',
    schema: {
      type: 'string',
      format: 'uuid',
    },
  })
  @ApiOkResponse({
    description: 'Provider transaction reversal requested successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid reversal request or Idempotency-Key header',
  })
  @ApiNotFoundResponse({
    description: 'Provider transaction not found',
  })
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
  @ApiOperation({
    summary: 'Get provider transaction reversals',
    description:
      'Returns provider reversal records using the supplied filters and pagination.',
  })
  @ApiOkResponse({
    description: 'Provider reversals retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid reversal query parameters',
  })
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
  @ApiOperation({
    summary: 'Get provider reversal by reference ID',
  })
  @ApiParam({
    name: 'reversalReferenceId',
    required: true,
    description: 'Provider reversal reference ID',
  })
  @ApiOkResponse({
    description: 'Provider reversal retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Provider reversal not found',
  })
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
  @ApiOperation({
    summary: 'Process or retry provider reversal',
    description:
      'Processes a pending provider reversal or retries a previously failed reversal.',
  })
  @ApiParam({
    name: 'reversalReferenceId',
    required: true,
    description: 'Provider reversal reference ID',
  })
  @ApiOkResponse({
    description: 'Provider reversal processed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Provider reversal cannot be processed in its current state',
  })
  @ApiNotFoundResponse({
    description: 'Provider reversal not found',
  })
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
  @ApiOperation({
    summary: 'Get provider transaction by reference ID',
  })
  @ApiParam({
    name: 'referenceId',
    required: true,
    description: 'Provider transaction reference ID',
  })
  @ApiOkResponse({
    description: 'Provider transaction retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Provider transaction not found',
  })
  getProviderTransactionAdmin(
    @Param('referenceId')
    referenceId: string,
  ) {
    return this.transactionService.getProviderTransaction(referenceId);
  }
}
