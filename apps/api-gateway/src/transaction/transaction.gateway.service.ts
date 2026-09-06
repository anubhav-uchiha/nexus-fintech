import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { firstValueFrom } from 'rxjs';

import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';

import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';

import { VIMOPAY_AEPS_PATTERNS } from '@nexus/common/aeps/vimopay/vimopay-aeps.patterns';

import { AdminProviderTransactionQueryDto } from './dto/admin-provider-transaction-query.dto';

import { ProviderReversalQueryDto } from './dto/provider-reversal-query.dto';

@Injectable()
export class TransactionGatewayService implements OnModuleInit {
  constructor(
    @Inject('TRANSACTION_SERVICE')
    private readonly client: ClientKafka,

    @Inject('TRANSACTION_AEPS_SERVICE')
    private readonly aepsClient: ClientKafka,
  ) {}

  async onModuleInit() {
    /*
     * ==========================================
     * TRANSACTION SERVICE
     * ==========================================
     */

    this.client.subscribeToResponseOf(TRANSACTION_PATTERNS.CREATE);

    this.client.subscribeToResponseOf(TRANSACTION_PATTERNS.GET_BY_REFERENCE);

    this.client.subscribeToResponseOf(TRANSACTION_PATTERNS.GET_BALANCE);

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.GET_PROVIDER_TRANSACTION,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.LIST_PROVIDER_TRANSACTIONS,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.LIST_RECONCILIATION_QUEUE,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.RESOLVE_PROVIDER_TRANSACTION,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.REQUEST_PROVIDER_TRANSACTION_REVERSAL,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.PROCESS_PROVIDER_TRANSACTION_REVERSAL,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.RECOVER_PROVIDER_FINANCIAL_EFFECTS,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.ADMIN_LIST_PROVIDER_TRANSACTIONS,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.LIST_PENDING_PROVIDER_INCOME,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.LIST_PROVIDER_REVERSALS,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.GET_PROVIDER_REVERSAL,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.GET_PROVIDER_RECEIPT,
    );

    this.aepsClient.subscribeToResponseOf(
      VIMOPAY_AEPS_PATTERNS.SYNC_IDEMPOTENCY_RECONCILIATION,
    );

    /*
     * ==========================================
     * AEPS SERVICE
     * ==========================================
     */

    this.aepsClient.subscribeToResponseOf(
      VIMOPAY_AEPS_PATTERNS.RECONCILE_PROVIDER_INCOME,
    );

    this.aepsClient.subscribeToResponseOf(
      VIMOPAY_AEPS_PATTERNS.SYNC_IDEMPOTENCY_RECONCILIATION,
    );

    await Promise.all([this.client.connect(), this.aepsClient.connect()]);
  }

  async createTransaction(dto: CreateTransactionDto) {
    try {
      return await firstValueFrom(
        this.client.send(TRANSACTION_PATTERNS.CREATE, dto),
      );
    } catch (error: any) {
      throw this.handleKafkaError(error);
    }
  }

  async getBalance(userId: string, walletType: 'MAIN' | 'AEPS' | 'PROFIT') {
    try {
      return await firstValueFrom(
        this.client.send(
          TRANSACTION_PATTERNS.GET_BALANCE,

          {
            userId,
            walletType,
          },
        ),
      );
    } catch (error: any) {
      throw this.handleKafkaError(error);
    }
  }

  async getTransactionByReference(referenceId: string) {
    try {
      return await firstValueFrom(
        this.client.send(
          TRANSACTION_PATTERNS.GET_BY_REFERENCE,

          {
            referenceId,
          },
        ),
      );
    } catch (error: any) {
      throw this.handleKafkaError(error);
    }
  }

  getProviderTransaction(referenceId: string, userId?: string) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.GET_PROVIDER_TRANSACTION,

        {
          referenceId,

          ...(userId
            ? {
                userId,
              }
            : {}),
        },
      ),
    );
  }

  listProviderTransactions(
    userId: string,

    query: {
      provider?: string;

      serviceType?: string;

      operation?: string;

      status?: string;

      settlementStatus?: string;

      commissionStatus?: string;

      fromDate?: string;

      toDate?: string;

      page?: number;

      limit?: number;
    },
  ) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.LIST_PROVIDER_TRANSACTIONS,

        {
          userId,

          ...query,
        },
      ),
    );
  }

  listProviderReconciliationQueue(query: {
    provider?: string;

    serviceType?: string;

    operation?: string;

    status?: 'PENDING' | 'UNKNOWN';

    page?: number;

    limit?: number;
  }) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.LIST_RECONCILIATION_QUEUE,

        query,
      ),
    );
  }

  /*
   * ==========================================
   * ADMIN RESOLVE
   * ==========================================
   *
   * Transaction Service resolves canonical
   * PTXN first.
   *
   * Then AEPS idempotency record is synced
   * so old PENDING / UNKNOWN request does
   * not remain permanently blocked.
   */

  async resolveProviderTransaction(
    referenceId: string,

    resolvedBy: string,

    dto: {
      resolution: 'SUCCESS' | 'FAILED';

      note?: string;

      providerTxnRefId?: string;

      rrn?: string;

      npciCode?: string;

      npciMessage?: string;
    },
  ) {
    /*
     * =====================================================
     * 1. RESOLVE CANONICAL PROVIDER TRANSACTION
     * =====================================================
     */

    const result = await firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.RESOLVE_PROVIDER_TRANSACTION,

        {
          referenceId,

          resolvedBy,

          ...dto,
        },
      ),
    );

    /*
     * =====================================================
     * 2. READ FINAL PTXN
     * =====================================================
     */

    const transaction: any = await this.getProviderTransaction(referenceId);

    /*
     * =====================================================
     * 3. SYNC VIMOPAY IDEMPOTENCY
     * =====================================================
     *
     * Only financial operations have
     * AEPS financial idempotency rows.
     */

    if (
      transaction?.provider === 'VIMOPAY' &&
      ['CW', 'AP', 'CD'].includes(transaction?.operation)
    ) {
      try {
        await firstValueFrom(
          this.aepsClient.send(
            VIMOPAY_AEPS_PATTERNS.SYNC_IDEMPOTENCY_RECONCILIATION,

            {
              identityId: transaction.userId,

              operation: transaction.operation,

              resolution: dto.resolution,

              idempotencyKey: transaction.idempotencyKey,

              providerMerchantRefId: transaction.providerMerchantRefId,

              providerTxnRefId:
                transaction.providerTxnRefId ?? dto.providerTxnRefId,

              /*
               * Store final canonical
               * transaction snapshot as the
               * idempotent response.
               */
              response: transaction,
            },
          ),
        );
      } catch (error) {
        /*
         * IMPORTANT:
         *
         * Canonical transaction already
         * financially reconciled ho chuki.
         *
         * AEPS idempotency sync failure ki
         * wajah se us financial resolution
         * ko rollback nahi karenge.
         */

        console.error('VimoPay idempotency reconciliation sync failed', error);
      }
    }

    return result;
  }
  requestProviderTransactionReversal(
    referenceId: string,

    requestedBy: string,

    reason: string,

    idempotencyKey: string,
  ) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.REQUEST_PROVIDER_TRANSACTION_REVERSAL,

        {
          referenceId,

          requestedBy,

          reason,

          idempotencyKey,
        },
      ),
    );
  }

  processProviderTransactionReversal(
    reversalReferenceId: string,

    processedBy: string,
  ) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.PROCESS_PROVIDER_TRANSACTION_REVERSAL,

        {
          reversalReferenceId,

          processedBy,
        },
      ),
    );
  }

  recoverProviderFinancialEffects(
    referenceId: string,

    recoveredBy: string,
  ) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.RECOVER_PROVIDER_FINANCIAL_EFFECTS,

        {
          referenceId,

          recoveredBy,
        },
      ),
    );
  }

  adminListProviderTransactions(query: AdminProviderTransactionQueryDto) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.ADMIN_LIST_PROVIDER_TRANSACTIONS,
        query,
      ),
    );
  }

  listPendingProviderIncome(query: AdminProviderTransactionQueryDto) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.LIST_PENDING_PROVIDER_INCOME,
        query,
      ),
    );
  }

  listProviderReversals(query: ProviderReversalQueryDto) {
    return firstValueFrom(
      this.client.send(TRANSACTION_PATTERNS.LIST_PROVIDER_REVERSALS, query),
    );
  }

  getProviderReversal(referenceId: string) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.GET_PROVIDER_REVERSAL,

        {
          referenceId,
        },
      ),
    );
  }

  getProviderReceipt(referenceId: string, userId?: string) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.GET_PROVIDER_RECEIPT,

        {
          referenceId,

          ...(userId
            ? {
                userId,
              }
            : {}),
        },
      ),
    );
  }

  /*
   * ==========================================
   * ADMIN PROVIDER INCOME
   * ==========================================
   */

  reconcileVimopayProviderIncome(input: {
    referenceId: string;

    reconciledBy: string;

    providerIncomeAmount?: number;

    incomeSource?: 'VIMOPAY_WALLET' | 'VIMOPAY_MS';

    externalReference?: string;
  }) {
    return firstValueFrom(
      this.aepsClient.send(
        VIMOPAY_AEPS_PATTERNS.RECONCILE_PROVIDER_INCOME,

        input,
      ),
    );
  }

  private handleKafkaError(error: any): Error {
    const statusCode = Number(error?.statusCode ?? 500);

    const message =
      typeof error?.message === 'string'
        ? error.message
        : 'Internal server error';

    switch (statusCode) {
      case 400:
        return new BadRequestException(message);

      case 404:
        return new NotFoundException(message);

      case 409:
        return new ConflictException(message);

      default:
        return new InternalServerErrorException(message);
    }
  }

  async getProviderTransactionForUser(referenceId: string, userId: string) {
    const transaction: any = await this.getProviderTransaction(
      referenceId,
      userId,
    );

    return {
      referenceId: transaction.referenceId,

      provider: transaction.provider,

      serviceType: transaction.serviceType,

      operation: transaction.operation,

      amount: transaction.amount,

      status: transaction.status,

      providerStatusCode: transaction.providerStatusCode,

      providerStatusMessage: transaction.providerStatusMessage,

      providerTxnRefId: transaction.providerTxnRefId,

      merchantRefId: transaction.providerMerchantRefId,

      rrn: transaction.rrn,

      npciCode: transaction.npciCode,

      npciMessage: transaction.npciMessage,

      bankIIN: transaction.bankIIN,

      aadhaarLast4: transaction.aadhaarLast4,

      settlementStatus: transaction.settlementStatus,

      /*
       * Frontend ko commission processing
       * lifecycle detail nahi chahiye.
       *
       * Bas settlement result.
       */
      commissionStatus: transaction.commissionStatus,

      createdAt: transaction.createdAt,

      completedAt: transaction.completedAt,

      reversedAt: transaction.reversedAt,
    };
  }
}
