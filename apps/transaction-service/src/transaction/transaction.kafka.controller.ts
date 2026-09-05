import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { TransactionService } from './transaction.service';
import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';
import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';
import { CreateCommissionTransactionDto } from '@nexus/common/transaction/dto/create-commission-transaction.dto';

import { CreateProviderTransactionDto } from '@nexus/common/transaction/dto/create-provider-transaction.dto';

import { FinalizeProviderTransactionDto } from '@nexus/common/transaction/dto/finalize-provider-transaction.dto';

import { MarkProviderTransactionUnknownDto } from '@nexus/common/transaction/dto/mark-provider-transaction-unknown.dto';

import { MarkProviderTransactionProcessingDto } from '@nexus/common/transaction/dto/mark-provider-transaction-processing.dto';
import { ListProviderTransactionsDto } from '@nexus/common/transaction/dto/list-provider-transactions.dto';
import { ResolveProviderTransactionDto } from '@nexus/common/transaction/dto/resolve-provider-transaction.dto';
import { ListProviderReconciliationDto } from '@nexus/common/transaction/dto/list-provider-reconciliation.dto';
import { RequestProviderTransactionReversalDto } from '@nexus/common/transaction/dto/request-provider-transaction-reversal.dto';
import { StartProviderTransactionReversalDto } from '@nexus/common/transaction/dto/start-provider-transaction-reversal.dto';
import { CompleteProviderTransactionReversalDto } from '@nexus/common/transaction/dto/complete-provider-transaction-reversal.dto';
import { FailProviderTransactionReversalDto } from '@nexus/common/transaction/dto/fail-provider-transaction-reversal.dto';

import { PostProviderWalletEntryDto } from '@nexus/common/transaction/dto/post-provider-wallet-entry.dto';
import { PrepareProviderWalletDebitDto } from '@nexus/common/transaction/dto/prepare-provider-wallet-debit.dto';
import { ConfirmProviderWalletReservationDto } from '@nexus/common/transaction/dto/confirm-provider-wallet-reservation.dto';
import { UpdateProviderCommissionStateDto } from '@nexus/common/transaction/dto/update-provider-commission-state.dto';
import { CreditCommissionDistributionDto } from '@nexus/common/wallet/dto/credit-commission-distribution.dto';
import { ProcessProviderTransactionReversalDto } from '@nexus/common/transaction/dto/process-provider-transaction-reversal.dto';
import { AdminListProviderTransactionsDto, ListProviderReversalsDto } from '@nexus/common/transaction/dto/admin-provider-transactions.dto';

@Controller()
export class TransactionKafkaController {
  constructor(private readonly transactionService: TransactionService) {}

  @MessagePattern(TRANSACTION_PATTERNS.CREATE)
  async createTransaction(@Payload() dto: CreateTransactionDto) {
    return this.transactionService.createTransaction(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.GET_BY_REFERENCE)
  async getTransactionByReference(
    @Payload()
    payload: {
      referenceId: string;
    },
  ) {
    return this.transactionService.getTransactionByReference(
      payload.referenceId,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.GET_BALANCE)
  async getCurrentBalance(
    @Payload()
    payload: {
      userId: string;
      walletType: 'MAIN' | 'AEPS' | 'PROFIT';
    },
  ) {
    return this.transactionService.getCurrentBalance(
      payload.userId,
      payload.walletType,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.TRANSFER)
  async transferMoney(@Payload() dto: TransferMoneyDto) {
    return this.transactionService.transferMoney(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.CREATE_COMMISSION)
  async createCommissionTransaction(
    @Payload() dto: CreateCommissionTransactionDto,
  ) {
    return this.transactionService.createCommissionTransaction(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.CREATE_PROVIDER_TRANSACTION)
  createProviderTransaction(
    @Payload()
    dto: CreateProviderTransactionDto,
  ) {
    return this.transactionService.createProviderTransaction(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.MARK_PROVIDER_TRANSACTION_PROCESSING)
  markProviderTransactionProcessing(
    @Payload()
    dto: MarkProviderTransactionProcessingDto,
  ) {
    return this.transactionService.markProviderTransactionProcessing(
      dto.referenceId,
      dto.providerMerchantRefId,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.FINALIZE_PROVIDER_TRANSACTION)
  finalizeProviderTransaction(
    @Payload()
    dto: FinalizeProviderTransactionDto,
  ) {
    return this.transactionService.finalizeProviderTransaction(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.MARK_PROVIDER_TRANSACTION_UNKNOWN)
  markProviderTransactionUnknown(
    @Payload()
    dto: MarkProviderTransactionUnknownDto,
  ) {
    return this.transactionService.markProviderTransactionUnknown(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.GET_PROVIDER_TRANSACTION)
  getProviderTransaction(
    @Payload()
    payload: {
      referenceId: string;
      userId?: string;
    },
  ) {
    return this.transactionService.getProviderTransaction(
      payload.referenceId,
      payload.userId,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.LIST_PROVIDER_TRANSACTIONS)
  listProviderTransactions(
    @Payload()
    dto: ListProviderTransactionsDto,
  ) {
    return this.transactionService.listProviderTransactions(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.LIST_RECONCILIATION_QUEUE)
  listProviderReconciliationQueue(
    @Payload()
    dto: ListProviderReconciliationDto,
  ) {
    return this.transactionService.listProviderReconciliationQueue(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.RESOLVE_PROVIDER_TRANSACTION)
  resolveProviderTransaction(
    @Payload()
    dto: ResolveProviderTransactionDto,
  ) {
    return this.transactionService.resolveProviderTransaction(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.REQUEST_PROVIDER_TRANSACTION_REVERSAL)
  requestProviderTransactionReversal(
    @Payload()
    dto: RequestProviderTransactionReversalDto,
  ) {
    return this.transactionService.requestProviderTransactionReversal(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.START_PROVIDER_TRANSACTION_REVERSAL)
  startProviderTransactionReversal(
    @Payload()
    dto: StartProviderTransactionReversalDto,
  ) {
    return this.transactionService.startProviderTransactionReversal(
      dto.reversalReferenceId,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.COMPLETE_PROVIDER_TRANSACTION_REVERSAL)
  completeProviderTransactionReversal(
    @Payload()
    dto: CompleteProviderTransactionReversalDto,
  ) {
    return this.transactionService.completeProviderTransactionReversal(
      dto.reversalReferenceId,
      dto.compensationReferenceId,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.FAIL_PROVIDER_TRANSACTION_REVERSAL)
  failProviderTransactionReversal(
    @Payload()
    dto: FailProviderTransactionReversalDto,
  ) {
    return this.transactionService.failProviderTransactionReversal(
      dto.reversalReferenceId,
      dto.reason,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.POST_PROVIDER_WALLET_ENTRY)
  postProviderWalletEntry(
    @Payload()
    dto: PostProviderWalletEntryDto,
  ) {
    return this.transactionService.postProviderWalletEntry(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.PREPARE_PROVIDER_WALLET_DEBIT)
  prepareProviderWalletDebit(
    @Payload()
    dto: PrepareProviderWalletDebitDto,
  ) {
    return this.transactionService.prepareProviderWalletDebit(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.CONFIRM_PROVIDER_WALLET_RESERVATION)
  confirmProviderWalletReservation(
    @Payload()
    dto: ConfirmProviderWalletReservationDto,
  ) {
    return this.transactionService.confirmProviderWalletReservation(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.UPDATE_PROVIDER_COMMISSION_STATE)
  updateProviderCommissionState(
    @Payload()
    dto: UpdateProviderCommissionStateDto,
  ) {
    return this.transactionService.updateProviderCommissionState(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.CREDIT_PROVIDER_COMMISSION_DISTRIBUTION)
  creditProviderCommissionDistribution(
    @Payload()
    dto: CreditCommissionDistributionDto,
  ) {
    return this.transactionService.creditProviderCommissionDistribution(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.PROCESS_PROVIDER_TRANSACTION_REVERSAL)
  processProviderTransactionReversal(
    @Payload()
    dto: ProcessProviderTransactionReversalDto,
  ) {
    return this.transactionService.processProviderTransactionReversal(
      dto.reversalReferenceId,
      dto.processedBy,
    );
  }

  @MessagePattern(
    TRANSACTION_PATTERNS.MARK_PROVIDER_FINANCIAL_RECOVERY_REQUIRED,
  )
  markProviderFinancialRecoveryRequired(
    @Payload()
    payload: {
      referenceId: string;
      reason: string;
    },
  ) {
    return this.transactionService.markProviderFinancialRecoveryRequired(
      payload.referenceId,
      payload.reason,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.RECOVER_PROVIDER_FINANCIAL_EFFECTS)
  recoverProviderFinancialEffects(
    @Payload()
    payload: {
      referenceId: string;
      recoveredBy: string;
    },
  ) {
    return this.transactionService.recoverProviderFinancialEffects(
      payload.referenceId,
      payload.recoveredBy,
    );
  }

  @MessagePattern(TRANSACTION_PATTERNS.ADMIN_LIST_PROVIDER_TRANSACTIONS)
  adminListProviderTransactions(
    @Payload()
    dto: AdminListProviderTransactionsDto,
  ) {
    return this.transactionService.adminListProviderTransactions(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.LIST_PENDING_PROVIDER_INCOME)
  listPendingProviderIncome(
    @Payload()
    dto: AdminListProviderTransactionsDto,
  ) {
    return this.transactionService.listPendingProviderIncome(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.LIST_PROVIDER_REVERSALS)
  listProviderReversals(
    @Payload()
    dto: ListProviderReversalsDto,
  ) {
    return this.transactionService.listProviderReversals(dto);
  }

  @MessagePattern(TRANSACTION_PATTERNS.GET_PROVIDER_REVERSAL)
  getProviderReversal(
    @Payload()
    payload: {
      referenceId: string;
    },
  ) {
    return this.transactionService.getProviderReversal(payload.referenceId);
  }

  @MessagePattern(TRANSACTION_PATTERNS.GET_PROVIDER_RECEIPT)
  getProviderReceipt(
    @Payload()
    payload: {
      referenceId: string;

      userId?: string;
    },
  ) {
    return this.transactionService.getProviderReceipt(
      payload.referenceId,
      payload.userId,
    );
  }
}
