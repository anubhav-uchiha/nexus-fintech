import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { firstValueFrom } from 'rxjs';

import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';

import { AepsWalletService } from '../wallet/aeps-wallet.service';

import { AepsProviderTransactionService } from '../transaction/aeps-provider-transaction.service';

export const AEPS_COMMISSION_CLIENT = 'AEPS_COMMISSION_CLIENT';

export interface AepsCommissionPreparationResult {
  status: 'NOT_REQUIRED' | 'PREPARED';

  commissionId: string | null;

  commissionReference: string | null;

  grossAmount: string;

  commissionAmount: string;

  netAmount: string;

  allocations: Array<{
    id: string;
    recipientUserId: string;
    recipientRole: string;
    amount: string;
    status: string;
  }>;

  reason?: string;
}

interface QuoteAepsCommissionInput {
  userId: string;

  role?: string;

  operation: 'CW' | 'AP' | 'CD';

  amount: number;
}

interface SettleAepsCommissionInput {
  providerTransactionId: string;

  providerTransactionReference: string;

  userId: string;

  role?: string;

  operation: 'CW' | 'AP' | 'CD';

  amount: number;
}

export interface AepsCommissionQuoteResult {
  commissionRequired: boolean;

  grossAmount: string;

  commissionAmount: string;

  netAmount: string;

  ruleId: string | null;

  reason?: string | null;
}

export interface AepsCommissionDistributionResult {
  id: string;

  distributionId: string | null;

  recipientUserId: string;

  recipientRole: string;

  amount: string;

  status: string;

  transactionId: string | null;

  transactionReference: string | null;

  failureReason: string | null;
}

export interface AepsCommissionSettlementResult {
  status: 'NOT_REQUIRED' | 'PENDING' | 'SETTLED';

  /*
   * Entire commission pool.
   */
  amount: string | null;

  grossAmount: string | null;

  netAmount: string | null;

  commissionReference: string | null;

  /*
   * Backward compatibility.
   *
   * Exactly one distribution ho to
   * wallet ref milega.
   *
   * Multiple distributions mein null.
   */
  walletTransactionReference: string | null;

  distributions: AepsCommissionDistributionResult[];

  reason?: string;
}

@Injectable()
export class AepsCommissionService implements OnModuleInit {
  private readonly logger = new Logger(AepsCommissionService.name);

  constructor(
    @Inject(AEPS_COMMISSION_CLIENT)
    private readonly client: ClientKafka,

    private readonly walletService: AepsWalletService,

    private readonly providerTransactionService: AepsProviderTransactionService,
  ) {}

  async onModuleInit() {
    /*
     * Quote.
     */
    this.client.subscribeToResponseOf(
      COMMISSION_PATTERNS.QUOTE_PROVIDER_COMMISSION,
    );

    /*
     * Commission snapshot creation.
     */
    this.client.subscribeToResponseOf(
      COMMISSION_PATTERNS.CREATE_PROVIDER_COMMISSION,
    );

    /*
     * Multiple allocation execution.
     */
    this.client.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_PROVIDER_COMMISSION_EXECUTION,
    );

    this.client.subscribeToResponseOf(
      COMMISSION_PATTERNS.MARK_DISTRIBUTION_SUCCESS,
    );

    this.client.subscribeToResponseOf(
      COMMISSION_PATTERNS.MARK_DISTRIBUTION_FAILED,
    );

    this.client.subscribeToResponseOf(
      COMMISSION_PATTERNS.FINALIZE_PROVIDER_DISTRIBUTIONS,
    );
    this.client.subscribeToResponseOf(
      COMMISSION_PATTERNS.CANCEL_PROVIDER_COMMISSION,
    );

    /*
     * Old FINALIZE_PROVIDER_COMMISSION
     * subscription intentionally removed.
     *
     * New AEPS flow individual dynamic
     * distributions finalize karta hai.
     */

    await this.client.connect();
  }

  /*
   * =====================================================
   * COMMISSION QUOTE
   * =====================================================
   *
   * IMPORTANT:
   *
   * Is method mein:
   *
   * - Commission row create nahi hoti
   * - Wallet movement nahi hoti
   *
   * Sirf:
   *
   * gross
   * commission
   * net
   *
   * calculate hota hai.
   */

  async quote(
    input: QuoteAepsCommissionInput,
  ): Promise<AepsCommissionQuoteResult> {
    if (!input.userId?.trim()) {
      throw new Error('User ID is required for commission quote');
    }

    /*
     * Future transaction amount net karna
     * isi quote par depend karega.
     *
     * Isliye missing trusted role par
     * silently zero commission nahi lenge.
     */
    if (!input.role?.trim()) {
      throw new Error('Authenticated role is unavailable for commission quote');
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Transaction amount must be greater than 0');
    }

    const serviceType = this.mapServiceType(input.operation);

    const quote: any = await firstValueFrom(
      this.client.send(
        COMMISSION_PATTERNS.QUOTE_PROVIDER_COMMISSION,

        {
          userId: input.userId,

          role: input.role,

          serviceType,

          operator: 'VIMOPAY',

          transactionAmount: input.amount,
        },
      ),
    );

    const grossAmount = Number(quote?.grossAmount ?? input.amount);

    const commissionAmount = Number(quote?.commissionAmount ?? 0);

    const netAmount = Number(
      quote?.netAmount ?? grossAmount - commissionAmount,
    );

    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      throw new Error('Invalid gross commission quote amount');
    }

    if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
      throw new Error('Invalid commission quote amount');
    }

    if (!Number.isFinite(netAmount) || netAmount <= 0) {
      throw new Error('Invalid net commission quote amount');
    }

    /*
     * Accounting conservation:
     *
     * gross = net + commission
     */
    const grossPaise = Math.round(grossAmount * 100);

    const commissionPaise = Math.round(commissionAmount * 100);

    const netPaise = Math.round(netAmount * 100);

    if (netPaise + commissionPaise !== grossPaise) {
      throw new Error('Commission quote accounting mismatch');
    }

    return {
      commissionRequired: Boolean(quote?.commissionRequired),

      grossAmount: (grossPaise / 100).toFixed(2),

      commissionAmount: (commissionPaise / 100).toFixed(2),

      netAmount: (netPaise / 100).toFixed(2),

      ruleId: quote?.ruleId ?? null,

      reason: quote?.reason ?? null,
    };
  }

  /*
   * =====================================================
   * COMMISSION SETTLEMENT
   * =====================================================
   */

  async settle(
    input: SettleAepsCommissionInput,
  ): Promise<AepsCommissionSettlementResult> {
    this.logger.log(
      `AEPS COMMISSION INPUT => userId=${input.userId}, role=${input.role}, operation=${input.operation}, amount=${input.amount}`,
    );

    if (!input.role?.trim()) {
      await this.safeMarkPending(
        input.providerTransactionReference,

        'Authenticated role is unavailable for commission calculation',
      );

      return {
        status: 'PENDING',

        amount: null,

        grossAmount: input.amount.toFixed(2),

        netAmount: null,

        commissionReference: null,

        walletTransactionReference: null,

        distributions: [],

        reason: 'ROLE_UNAVAILABLE',
      };
    }

    const serviceType = this.mapServiceType(input.operation);

    const commissionIdempotencyKey = `AEPS:${input.providerTransactionReference}:COMMISSION`;

    try {
      /*
       * ===================================================
       * 1. CREATE COMMISSION + SNAPSHOT ALL DISTRIBUTIONS
       * ===================================================
       *
       * This is idempotent.
       */

      const commission: any = await firstValueFrom(
        this.client.send(
          COMMISSION_PATTERNS.CREATE_PROVIDER_COMMISSION,

          {
            providerTransactionId: input.providerTransactionId,

            providerTransactionReference: input.providerTransactionReference,

            userId: input.userId,

            role: input.role,

            serviceType,

            operator: 'VIMOPAY',

            /*
             * IMPORTANT:
             *
             * Gross transaction amount.
             */
            transactionAmount: input.amount,

            idempotencyKey: commissionIdempotencyKey,
          },
        ),
      );

      /*
       * ===================================================
       * NO COMMISSION
       * ===================================================
       */

      if (commission?.commissionRequired === false) {
        await this.providerTransactionService.updateCommissionState({
          referenceId: input.providerTransactionReference,

          status: 'NOT_REQUIRED',
        });

        return {
          status: 'NOT_REQUIRED',

          amount: '0.00',

          grossAmount: String(
            commission?.grossAmount ?? input.amount.toFixed(2),
          ),

          netAmount: String(commission?.netAmount ?? input.amount.toFixed(2)),

          commissionReference: null,

          walletTransactionReference: null,

          distributions: [],

          reason: commission.reason ?? 'NO_COMMISSION',
        };
      }

      if (!commission?.id || !commission?.referenceId) {
        throw new Error('Commission record was not received');
      }

      const commissionAmount = Number(commission.commissionAmount);

      const grossAmount = Number(
        commission.grossAmount ?? commission.transactionAmount ?? input.amount,
      );

      const netAmount = Number(
        commission.netAmount ?? grossAmount - commissionAmount,
      );

      if (!Number.isFinite(commissionAmount) || commissionAmount <= 0) {
        throw new Error('Invalid commission amount received');
      }

      if (
        !Number.isFinite(grossAmount) ||
        !Number.isFinite(netAmount) ||
        netAmount <= 0
      ) {
        throw new Error('Invalid commission accounting amounts received');
      }

      /*
       * Conservation check.
       */
      if (
        Math.round((netAmount + commissionAmount) * 100) !==
        Math.round(grossAmount * 100)
      ) {
        throw new Error('Commission gross/net accounting mismatch');
      }

      /*
       * ===================================================
       * 2. PROVIDER TRANSACTION → COMMISSION PENDING
       * ===================================================
       *
       * Existing successful commission retry case
       * mein unnecessary downgrade nahi karna.
       */

      if (commission.status !== 'SUCCESS') {
        await this.providerTransactionService.updateCommissionState({
          referenceId: input.providerTransactionReference,

          status: 'PENDING',

          commissionReferenceId: commission.referenceId,

          commissionAmount,
        });
      }

      /*
       * ===================================================
       * 3. EXECUTE ALL DYNAMIC DISTRIBUTIONS
       * ===================================================
       */

      const executionResult = await this.executeDistributions({
        commissionId: commission.id,

        commissionReference: commission.referenceId,

        serviceType,
      });

      /*
       * ===================================================
       * 4. READ FRESH EXECUTION STATE
       * ===================================================
       */

      const execution: any = await firstValueFrom(
        this.client.send(
          COMMISSION_PATTERNS.GET_PROVIDER_COMMISSION_EXECUTION,

          {
            commissionReference: commission.referenceId,
          },
        ),
      );

      const allocations: any[] = Array.isArray(execution?.allocations)
        ? execution.allocations
        : [];

      const distributions = allocations.map(
        (allocation): AepsCommissionDistributionResult => ({
          id: allocation.id,

          distributionId: allocation.distributionId ?? null,

          recipientUserId: allocation.recipientUserId,

          recipientRole: allocation.recipientRole,

          amount: String(allocation.amount),

          status: allocation.status,

          transactionId: allocation.transactionId ?? null,

          transactionReference: allocation.transactionReference ?? null,

          failureReason: allocation.failureReason ?? null,
        }),
      );

      /*
       * ===================================================
       * 5. ALL ALLOCATIONS SUCCESS
       * ===================================================
       */

      if (executionResult?.status === 'SUCCESS') {
        await this.providerTransactionService.updateCommissionState({
          referenceId: input.providerTransactionReference,

          status: 'SETTLED',

          commissionReferenceId: commission.referenceId,

          commissionAmount,

          /*
           * Multiple dynamic wallet credits
           * ho sakti hain.
           *
           * Isliye single wallet ref sirf
           * exactly one allocation case mein.
           */
          ...(distributions.length === 1 &&
          distributions[0].transactionReference
            ? {
                commissionWalletTransactionReference:
                  distributions[0].transactionReference!,
              }
            : {}),
        });

        return {
          status: 'SETTLED',

          amount: commissionAmount.toFixed(2),

          grossAmount: grossAmount.toFixed(2),

          netAmount: netAmount.toFixed(2),

          commissionReference: commission.referenceId,

          walletTransactionReference:
            distributions.length === 1
              ? distributions[0].transactionReference
              : null,

          distributions,
        };
      }

      /*
       * ===================================================
       * 6. PARTIAL / FAILED DISTRIBUTION
       * ===================================================
       *
       * Commission remains retryable.
       */

      const failedCount = distributions.filter(
        (item) => item.status === 'FAILED',
      ).length;

      const pendingCount = distributions.filter(
        (item) => item.status === 'PENDING',
      ).length;

      await this.safeMarkPending(
        input.providerTransactionReference,

        failedCount > 0
          ? `${failedCount} commission distribution(s) failed and require retry`
          : `${pendingCount} commission distribution(s) are pending`,
      );

      return {
        status: 'PENDING',

        amount: commissionAmount.toFixed(2),

        grossAmount: grossAmount.toFixed(2),

        netAmount: netAmount.toFixed(2),

        commissionReference: commission.referenceId,

        walletTransactionReference: null,

        distributions,

        reason:
          failedCount > 0
            ? 'COMMISSION_DISTRIBUTION_PARTIAL_FAILURE'
            : 'COMMISSION_DISTRIBUTION_PENDING',
      };
    } catch (error) {
      const message = this.extractErrorMessage(error);

      await this.safeMarkPending(
        input.providerTransactionReference,

        message,
      );

      this.logger.error(
        `AEPS commission settlement pending for ${input.providerTransactionReference}: ${message}`,

        error instanceof Error ? error.stack : undefined,
      );

      return {
        status: 'PENDING',

        amount: null,

        grossAmount: input.amount.toFixed(2),

        netAmount: null,

        commissionReference: null,

        walletTransactionReference: null,

        distributions: [],

        reason: 'COMMISSION_SETTLEMENT_PENDING',
      };
    }
  }

  /*
   * =====================================================
   * EXECUTE MULTIPLE DISTRIBUTIONS
   * =====================================================
   */

  private async executeDistributions(input: {
    commissionId: string;

    commissionReference: string;

    serviceType: string;
  }) {
    /*
     * Always fresh snapshot execution state.
     */
    const execution: any = await firstValueFrom(
      this.client.send(
        COMMISSION_PATTERNS.GET_PROVIDER_COMMISSION_EXECUTION,

        {
          commissionReference: input.commissionReference,
        },
      ),
    );

    const allocations: any[] = Array.isArray(execution?.allocations)
      ? execution.allocations
      : [];

    if (allocations.length === 0) {
      throw new Error('Commission has no distribution allocations');
    }

    /*
     * ===================================================
     * MONEY CONSERVATION BEFORE ANY CREDIT
     * ===================================================
     */

    const commissionPaise = Math.round(
      Number(execution.commissionAmount) * 100,
    );

    const allocatedPaise = allocations.reduce(
      (total, allocation) =>
        total + Math.round(Number(allocation.amount) * 100),

      0,
    );

    if (!Number.isFinite(commissionPaise) || commissionPaise <= 0) {
      throw new Error('Invalid commission pool amount');
    }

    if (allocatedPaise !== commissionPaise) {
      throw new Error(
        `Commission allocation mismatch before wallet execution. Commission ₹${(
          commissionPaise / 100
        ).toFixed(2)}, allocations ₹${(allocatedPaise / 100).toFixed(2)}`,
      );
    }

    /*
     * ===================================================
     * PROCESS ALL ALLOCATIONS
     * ===================================================
     *
     * IMPORTANT:
     *
     * Ek allocation fail hone se
     * loop stop nahi hogi.
     */

    for (const allocation of allocations) {
      /*
       * Already successful allocation
       * skip.
       */
      if (allocation.status === 'SUCCESS') {
        continue;
      }

      /*
       * Reversed allocations current
       * forward settlement mein retry
       * nahi hongi.
       */
      if (allocation.status === 'REVERSED') {
        continue;
      }

      const amount = Number(allocation.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        await this.markAllocationFailedSafely(
          allocation.id,

          'Invalid commission distribution amount',
        );

        continue;
      }

      if (!allocation.recipientUserId) {
        await this.markAllocationFailedSafely(
          allocation.id,

          'Commission recipient is missing',
        );

        continue;
      }

      if (!allocation.idempotencyKey) {
        await this.markAllocationFailedSafely(
          allocation.id,

          'Commission distribution idempotency key is missing',
        );

        continue;
      }

      try {
        /*
         * Individual recipient PROFIT
         * wallet credit.
         */
        const walletTransaction: any =
          await this.walletService.creditCommissionDistribution({
            recipientUserId: allocation.recipientUserId,

            recipientRole: allocation.recipientRole,

            commissionId: input.commissionId,

            commissionReference: input.commissionReference,

            distributionTransactionId: allocation.id,

            amount,

            serviceType: `${input.serviceType}_COMMISSION`,

            /*
             * Individual snapshot row
             * has its own idempotency.
             */
            idempotencyKey: allocation.idempotencyKey,
          });

        if (!walletTransaction?.id || !walletTransaction?.referenceId) {
          throw new Error(
            'Commission distribution wallet transaction is incomplete',
          );
        }

        /*
         * Wallet credit ho chuki.
         *
         * Mark allocation successful.
         */
        await firstValueFrom(
          this.client.send(
            COMMISSION_PATTERNS.MARK_DISTRIBUTION_SUCCESS,

            {
              distributionTransactionId: allocation.id,

              walletTransactionId: walletTransaction.id,

              walletTransactionReference: walletTransaction.referenceId,
            },
          ),
        );
      } catch (error) {
        const message = this.extractErrorMessage(error);

        /*
         * Same commission ke remaining
         * allocations process hote rahenge.
         */
        await this.markAllocationFailedSafely(
          allocation.id,

          message,
        );

        this.logger.error(
          `Commission distribution ${allocation.id} failed: ${message}`,

          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    /*
     * ===================================================
     * FINALIZE OVERALL COMMISSION
     * ===================================================
     */

    return firstValueFrom(
      this.client.send(
        COMMISSION_PATTERNS.FINALIZE_PROVIDER_DISTRIBUTIONS,

        {
          commissionReference: input.commissionReference,
        },
      ),
    );
  }

  private async markAllocationFailedSafely(
    distributionTransactionId: string,

    reason: string,
  ) {
    try {
      await firstValueFrom(
        this.client.send(
          COMMISSION_PATTERNS.MARK_DISTRIBUTION_FAILED,

          {
            distributionTransactionId,

            reason,
          },
        ),
      );
    } catch (error) {
      this.logger.error(
        `Unable to mark commission distribution ${distributionTransactionId} failed`,

        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private mapServiceType(operation: 'CW' | 'AP' | 'CD'): string {
    switch (operation) {
      case 'CW':
        return 'AEPS_CASH_WITHDRAWAL';

      case 'AP':
        return 'AEPS_AADHAAR_PAY';

      case 'CD':
        return 'AEPS_CASH_DEPOSIT';

      default:
        throw new Error(`Unsupported AEPS commission operation: ${operation}`);
    }
  }

  private async safeMarkPending(
    referenceId: string,

    reason: string,
  ) {
    try {
      await this.providerTransactionService.updateCommissionState({
        referenceId,

        status: 'PENDING',

        failureReason: reason,
      });
    } catch (error) {
      /*
       * Already SETTLED transaction ko
       * PENDING downgrade karne ka attempt
       * fail ho sakta hai.
       *
       * Original state preserve karenge.
       */

      this.logger.error(
        `Unable to mark commission pending for ${referenceId}`,

        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    const candidate = error as any;

    return (
      candidate?.message ??
      candidate?.error?.message ??
      'Commission settlement failed'
    );
  }

  async prepare(
    input: SettleAepsCommissionInput,
  ): Promise<AepsCommissionPreparationResult> {
    if (!input.userId?.trim()) {
      throw new Error('User ID is required for commission preparation');
    }

    if (!input.role?.trim()) {
      throw new Error(
        'Authenticated role is unavailable for commission preparation',
      );
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Transaction amount must be greater than 0');
    }

    const serviceType = this.mapServiceType(input.operation);

    const commissionIdempotencyKey = `AEPS:${input.providerTransactionReference}:COMMISSION`;

    /*
     * CREATE_PROVIDER_COMMISSION itself
     * idempotent hai.
     *
     * First call:
     * rule + hierarchy + ALL dynamic
     * distributions snapshot.
     *
     * Later settle():
     * same snapshot return hogi.
     */
    let commission: any;

    try {
      commission = await firstValueFrom(
        this.client.send(
          COMMISSION_PATTERNS.CREATE_PROVIDER_COMMISSION,

          {
            providerTransactionId: input.providerTransactionId,

            providerTransactionReference: input.providerTransactionReference,

            userId: input.userId,

            role: input.role,

            serviceType,

            operator: 'VIMOPAY',

            transactionAmount: input.amount,

            idempotencyKey: commissionIdempotencyKey,
          },
        ),
      );
    } catch (error) {
      this.logger.error(
        `Commission preparation failed for ${input.providerTransactionReference}`,
      );

      this.throwDownstreamError(error, 'Commission preparation failed');
    }

    /*
     * No commission configured.
     */
    if (commission?.commissionRequired === false) {
      await this.providerTransactionService.updateCommissionState({
        referenceId: input.providerTransactionReference,

        status: 'NOT_REQUIRED',
      });

      return {
        status: 'NOT_REQUIRED',

        commissionId: null,

        commissionReference: null,

        grossAmount: String(commission.grossAmount ?? input.amount.toFixed(2)),

        commissionAmount: '0.00',

        netAmount: String(commission.netAmount ?? input.amount.toFixed(2)),

        allocations: [],

        reason: commission.reason ?? 'NO_COMMISSION',
      };
    }

    if (!commission?.id || !commission?.referenceId) {
      throw new Error(
        'Commission preparation did not return a commission record',
      );
    }

    const grossAmount = Number(
      commission.grossAmount ?? commission.transactionAmount ?? input.amount,
    );

    const commissionAmount = Number(commission.commissionAmount);

    const netAmount = Number(
      commission.netAmount ?? grossAmount - commissionAmount,
    );

    if (
      !Number.isFinite(grossAmount) ||
      !Number.isFinite(commissionAmount) ||
      !Number.isFinite(netAmount) ||
      grossAmount <= 0 ||
      commissionAmount <= 0 ||
      netAmount <= 0
    ) {
      throw new Error('Invalid commission preparation amounts');
    }

    /*
     * Money conservation.
     */
    const grossPaise = Math.round(grossAmount * 100);

    const commissionPaise = Math.round(commissionAmount * 100);

    const netPaise = Math.round(netAmount * 100);

    if (commissionPaise + netPaise !== grossPaise) {
      throw new Error('Commission preparation accounting mismatch');
    }

    await this.providerTransactionService.updateCommissionState({
      referenceId: input.providerTransactionReference,

      status: 'PENDING',

      commissionReferenceId: commission.referenceId,

      commissionAmount,
    });

    return {
      status: 'PREPARED',

      commissionId: commission.id,

      commissionReference: commission.referenceId,

      grossAmount: grossAmount.toFixed(2),

      commissionAmount: commissionAmount.toFixed(2),

      netAmount: netAmount.toFixed(2),

      allocations: Array.isArray(commission.allocations)
        ? commission.allocations.map((item: any) => ({
            id: item.id,

            recipientUserId: item.recipientUserId,

            recipientRole: item.recipientRole,

            amount: String(item.amount),

            status: item.status,
          }))
        : [],
    };
  }

  async cancel(input: {
    providerTransactionReference: string;

    commissionReference: string | null;

    reason: string;
  }) {
    /*
     * No commission rule tha.
     */
    if (!input.commissionReference) {
      return;
    }

    await firstValueFrom(
      this.client.send(
        COMMISSION_PATTERNS.CANCEL_PROVIDER_COMMISSION,

        {
          commissionReference: input.commissionReference,

          reason: input.reason,
        },
      ),
    );

    try {
      await this.providerTransactionService.updateCommissionState({
        referenceId: input.providerTransactionReference,

        status: 'FAILED',

        failureReason: input.reason,
      });
    } catch (error) {
      this.logger.error(
        `Unable to mark provider commission failed for ${input.providerTransactionReference}`,

        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private throwDownstreamError(error: any, fallbackMessage: string): never {
    let payload = error?.error ?? error?.response ?? error;

    /*
     * Kafka kabhi JSON string bhi
     * return kar sakta hai.
     */
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        throw new HttpException(
          {
            statusCode: 500,
            message: payload || fallbackMessage,
          },
          500,
        );
      }
    }

    /*
     * Sometimes error.error itself nested
     * response hoti hai.
     */
    const nested =
      payload?.error && typeof payload.error === 'object'
        ? payload.error
        : payload;

    let statusCode = Number(
      nested?.statusCode ??
        payload?.statusCode ??
        nested?.status ??
        payload?.status,
    );

    if (!Number.isFinite(statusCode) || statusCode < 400 || statusCode > 599) {
      statusCode = 500;
    }

    const message =
      nested?.message ?? payload?.message ?? error?.message ?? fallbackMessage;

    throw new HttpException(
      {
        statusCode,

        message: Array.isArray(message) ? message.join(', ') : String(message),

        code: 'AEPS_COMMISSION_CONFIGURATION_ERROR',
      },
      statusCode,
    );
  }
}
