import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

import { PrismaService } from '../../../database/prisma.service';

import { VimopayService } from '../vimopay.service';

import { VimopayTransactionAccessService } from './vimopay-transaction-access.service';
import {
  AepsFinancialTransactionType,
  VimopayTxnAuthStatus,
  VimopayTxnAuthType,
} from '../../../../generated/prisma/enums';
import { VimopayIdempotencyService } from './vimopay-idempotency.service';

import { VimopayBalanceEnquiryRequestDto } from './dto/vimopay-balance-enquiry-request.dto';

import { VimopayBalanceEnquiryDto } from '../dto/balance-enquiry.dto';
import { VimopayMiniStatementRequestDto } from './dto/vimopay-mini-statement-request.dto';

import { VimopayMiniStatementDto } from '../dto/mini-statement.dto';

import { VimopayCashWithdrawalRequestDto } from './dto/vimopay-cash-withdrawal-request.dto';

import { VimopayCashWithdrawalDto } from '../dto/cash-withdrawal.dto';
import { VimopayCashWithdrawalOtpRequestDto } from './dto/vimopay-cw-otp-request.dto';

import { VimopayAepsTransactionOtpDto } from '../dto/aeps-transaction-otp.dto';

import { VimopayAadhaarPayDto } from '../dto/aadhaar-pay.dto';

import { VimopayAadhaarPayRequestDto } from './dto/vimopay-aadhaar-pay-request.dto';

import { VimopayAadhaarPayOtpRequestDto } from './dto/vimopay-ap-otp-request.dto';

import { VimopayCashDepositDto } from '../dto/cash-deposit.dto';

import { VimopayCashDepositRequestDto } from './dto/vimopay-cash-deposit-request.dto';

import { AepsProviderTransactionService } from '../../../integrations/transaction/aeps-provider-transaction.service';
import { VimopayTxnAuthCleanupService } from './vimopay-txn-auth-cleanup.service';
import { AepsWalletService } from '../../../integrations/wallet/aeps-wallet.service';
import {
  AepsCommissionService,
  AepsCommissionSettlementResult,
} from '../../../integrations/commission/aeps-commission.service';
import { VimopayIncomeService } from '../income/vimopay-income.service';

export interface VimopayTransactionContext {
  identityId: string;
  role?: string;
  ipAddress: string;
}

export interface VimopayProviderIncomeReconciliationInput {
  referenceId: string;

  reconciledBy: string;

  /*
   * Production only.
   *
   * UAT mein ignored —
   * system simulated 2% calculate karega.
   */
  providerIncomeAmount?: number;

  incomeSource?: 'VIMOPAY_WALLET' | 'VIMOPAY_MS';

  /*
   * Production wallet/MS ledger
   * transaction reference.
   */
  externalReference?: string;
}

@Injectable()
export class VimopayTransactionService {
  private readonly logger = new Logger(VimopayTransactionService.name);
  constructor(
    private readonly accessService: VimopayTransactionAccessService,
    private readonly vimopayService: VimopayService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly idempotencyService: VimopayIdempotencyService,
    private readonly providerTransactionService: AepsProviderTransactionService,
    private readonly txnAuthCleanupService: VimopayTxnAuthCleanupService,
    private readonly walletService: AepsWalletService,
    private readonly commissionService: AepsCommissionService,
    private readonly vimopayIncomeService: VimopayIncomeService,
  ) {}

  /*
   * =====================================================
   * BALANCE ENQUIRY
   * =====================================================
   */

  async balanceEnquiry(
    context: VimopayTransactionContext,

    dto: VimopayBalanceEnquiryRequestDto,
  ) {
    /*
     * =====================================================
     * 1. ACTIVE MERCHANT + DAILY 2FA
     * =====================================================
     */

    const merchant = await this.accessService.getActiveMerchant(
      context.identityId,
    );

    /*
     * =====================================================
     * 2. CREATE INTERNAL PROVIDER TRANSACTION
     * =====================================================
     *
     * BE financial wallet movement nahi hai,
     * amount = 0.
     */

    const providerTransaction = await this.providerTransactionService.create({
      userId: context.identityId,

      serviceType: 'AEPS',

      provider: 'VIMOPAY',

      operation: 'BE',

      amount: 0,

      merchantProfileId: merchant.profileId,

      providerMerchantId: merchant.merchantId,

      bankIIN: dto.bankIIN,

      /*
       * Full Aadhaar store nahi.
       */
      aadhaarLast4: dto.aadhaarNumber.slice(-4),

      metadata: {
        category: 'NON_FINANCIAL',
        
      },
    });

    /*
     * =====================================================
     * 3. BACKEND PROVIDER REFERENCE
     * =====================================================
     */

    const merchantRefId = this.generateMerchantRefId('BE');

    /*
     * Provider ko request bhejne se just
     * pehle canonical transaction:
     *
     * INITIATED → PROCESSING
     */
    await this.providerTransactionService.markProcessing(
      providerTransaction.referenceId,

      merchantRefId,
    );

    let providerCallStarted = false;

    try {
      /*
       * ===================================================
       * 4. BUILD PROVIDER DTO
       * ===================================================
       */

      const providerDto: VimopayBalanceEnquiryDto = {
        merchantRefId,

        /*
         * DB se trusted.
         */
        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        bankIIN: dto.bankIIN,

        /*
         * Request/server context.
         */
        ipAddress: context.ipAddress,

        lat: dto.lat,

        long: dto.long,

        deviceType: dto.deviceType,

        pidData: dto.pidData,

        cwAuthTxnId: '',

        udf1: dto.udf1 ?? '',

        udf2: dto.udf2 ?? '',

        udf3: dto.udf3 ?? '',
      };

      /*
       * ===================================================
       * 5. PROVIDER CALL
       * ===================================================
       */

      providerCallStarted = true;

      const result = await this.vimopayService.balanceEnquiry(providerDto);

      /*
       * ===================================================
       * 6. MAP PROVIDER STATUS
       * ===================================================
       */

      const finalStatus = this.mapProviderTransactionStatus(result.status);

      if (finalStatus) {
        /*
         * Provider ne definitive result diya.
         */
        await this.providerTransactionService.finalize({
          referenceId: providerTransaction.referenceId,

          status: finalStatus,

          providerMerchantRefId: merchantRefId,

          providerTxnRefId: result.txnRefId,

          rrn: result.rrn,

          npciCode: result.npciCode,

          npciMessage: result.npciMessage,

          providerStatusCode: result.status,

          providerStatusMessage: result.statusDescription,

          metadata: {
            category: 'NON_FINANCIAL',
            ...this.getSafeReceiptMetadata(result),
          },
        });
      } else {
        /*
         * Unexpected provider state.
         *
         * Automatic assumptions nahi.
         */
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransaction.referenceId,

          providerMerchantRefId: merchantRefId,

          reason: `Unexpected VimoPay transaction status: ${result.status}`,
        });
      }

      /*
       * ===================================================
       * 7. API RESPONSE
       * ===================================================
       */

      return {
        provider: 'VIMOPAY',

        transactionType: 'BE',

        /*
         * Important:
         * hamara canonical transaction reference.
         */
        transactionReferenceId: providerTransaction.referenceId,

        profileId: merchant.profileId,

        merchantRefId,

        providerMerchantId: merchant.merchantId,

        result,
      };
    } catch (error) {
      /*
       * Provider request start ho chuki thi,
       * but definitive response nahi mila.
       *
       * Duplicate retry dangerous ho sakti hai
       * financial operations mein, so generic
       * tracking rule UNKNOWN hai.
       */
      if (providerCallStarted) {
        try {
          await this.providerTransactionService.markUnknown({
            referenceId: providerTransaction.referenceId,

            providerMerchantRefId: merchantRefId,

            reason:
              error instanceof Error
                ? error.message
                : 'VimoPay provider request failed',
          });
        } catch {
          /*
           * Original provider error ko mask
           * nahi karenge.
           */
        }
      }

      throw error;
    }
  }

  /*
   * =====================================================
   * MINI STATEMENT
   * =====================================================
   */

  async miniStatement(
    context: VimopayTransactionContext,
    dto: VimopayMiniStatementRequestDto,
  ) {
    /*
     * =====================================================
     * 1. ACTIVE MERCHANT + DAILY 2FA
     * =====================================================
     */

    const merchant = await this.accessService.getActiveMerchant(
      context.identityId,
    );

    /*
     * =====================================================
     * 2. CREATE CANONICAL PROVIDER TRANSACTION
     * =====================================================
     *
     * Mini Statement non-financial transaction hai.
     * amount = 0
     */

    const providerTransaction = await this.providerTransactionService.create({
      userId: context.identityId,

      serviceType: 'AEPS',

      provider: 'VIMOPAY',

      operation: 'MS',

      amount: 0,

      merchantProfileId: merchant.profileId,

      providerMerchantId: merchant.merchantId,

      bankIIN: dto.bankIIN,

      aadhaarLast4: dto.aadhaarNumber.slice(-4),

      metadata: {
        category: 'NON_FINANCIAL',
        
      },
    });

    /*
     * =====================================================
     * 3. BACKEND PROVIDER REFERENCE
     * =====================================================
     */

    const merchantRefId = this.generateMerchantRefId('MS');

    /*
     * =====================================================
     * 4. MARK PROCESSING
     * =====================================================
     */

    await this.providerTransactionService.markProcessing(
      providerTransaction.referenceId,
      merchantRefId,
    );

    let providerCallStarted = false;

    try {
      /*
       * ===================================================
       * 5. BUILD PROVIDER DTO
       * ===================================================
       */

      const providerDto: VimopayMiniStatementDto = {
        merchantRefId,

        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        bankIIN: dto.bankIIN,

        ipAddress: context.ipAddress,

        lat: dto.lat,

        long: dto.long,

        deviceType: dto.deviceType,

        pidData: dto.pidData,

        /*
         * MS mein transaction OTP nahi hai.
         */
        cwAuthTxnId: '',

        udf1: dto.udf1 ?? '',

        udf2: dto.udf2 ?? '',

        udf3: dto.udf3 ?? '',
      };

      /*
       * ===================================================
       * 6. PROVIDER CALL
       * ===================================================
       */

      providerCallStarted = true;

      const result = await this.vimopayService.miniStatement(providerDto);

      /*
       * ===================================================
       * 7. PROVIDER STATUS → INTERNAL STATUS
       * ===================================================
       */

      const finalStatus = this.mapProviderTransactionStatus(result.status);

      if (finalStatus) {
        await this.providerTransactionService.finalize({
          referenceId: providerTransaction.referenceId,

          status: finalStatus,

          providerMerchantRefId: merchantRefId,

          providerTxnRefId: result.txnRefId,

          rrn: result.rrn,

          npciCode: result.npciCode,

          npciMessage: result.npciMessage,

          providerStatusCode: result.status,

          providerStatusMessage: result.statusDescription,

          /*
           * Raw mini-statement transactionList
           * DB mein intentionally save nahi kar rahe.
           */
          metadata: {
            category: 'NON_FINANCIAL',
            ...this.getSafeReceiptMetadata(result),
          },
        });
      } else {
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransaction.referenceId,

          providerMerchantRefId: merchantRefId,

          reason: `Unexpected VimoPay transaction status: ${result.status}`,
        });
      }

      /*
       * ===================================================
       * 8. RESPONSE
       * ===================================================
       */

      return {
        provider: 'VIMOPAY',

        transactionType: 'MS',

        /*
         * Hamara canonical reference.
         */
        transactionReferenceId: providerTransaction.referenceId,

        profileId: merchant.profileId,

        merchantRefId,

        providerMerchantId: merchant.merchantId,

        result,
      };
    } catch (error) {
      /*
       * Provider request start ho gayi thi
       * but definitive response nahi mili.
       */
      if (providerCallStarted) {
        try {
          await this.providerTransactionService.markUnknown({
            referenceId: providerTransaction.referenceId,

            providerMerchantRefId: merchantRefId,

            reason:
              error instanceof Error
                ? error.message
                : 'VimoPay Mini Statement request failed',
          });
        } catch {
          /*
           * Tracking error original
           * provider error ko mask nahi karega.
           */
        }
      }

      throw error;
    }
  }

  /*
   * =====================================================
   * CASH WITHDRAWAL
   * =====================================================
   */

  async cashWithdrawal(
    context: VimopayTransactionContext,
    dto: VimopayCashWithdrawalRequestDto,
    idempotencyKey: string,
  ) {
    /*
     * =====================================================
     * 1. ACTIVE MERCHANT + DAILY 2FA
     * =====================================================
     */

    const merchant = await this.accessService.getActiveMerchant(
      context.identityId,
    );

    /*
     * Financial transactions mein role
     * mandatory hai because delayed
     * provider-income reconciliation later
     * same source role use karegi.
     */
    const sourceRole = this.requireFinancialSourceRole(context);

    const amount = Number(dto.amount);

    if (!Number.isFinite(amount) || amount < 100 || amount > 10000) {
      throw new BadRequestException(
        'Cash Withdrawal amount must be between 100 and 10000',
      );
    }

    /*
     * <= 5000 → transaction OTP nahi.
     */
    if (amount <= 5000 && dto.authRequestId) {
      throw new BadRequestException(
        'authRequestId must not be provided for Cash Withdrawal up to 5000',
      );
    }

    /*
     * > 5000 → CWTFA mandatory.
     */
    if (amount > 5000 && !dto.authRequestId) {
      throw new BadRequestException({
        message:
          'Cash Withdrawal above 5000 requires transaction authorization',

        code: 'VIMOPAY_CW_TRANSACTION_OTP_REQUIRED',
      });
    }

    /*
     * =====================================================
     * 2. IDEMPOTENCY
     * =====================================================
     */

    const requestHash = this.idempotencyService.createRequestHash({
      transactionType: 'CW',

      amount: amount.toFixed(2),

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,

      mobileNumber: dto.mobileNumber,
    });

    const idempotency = await this.idempotencyService.begin({
      identityId: context.identityId,

      profileId: merchant.profileId,

      transactionType: AepsFinancialTransactionType.CASH_WITHDRAWAL,

      idempotencyKey,

      requestHash,
    });

    if (!idempotency.shouldExecute) {
      return idempotency.response;
    }

    /*
     * =====================================================
     * 3. STATE
     * =====================================================
     */

    let cwAuthTxnId = '';

    let claimedAuthorizationId: string | null = null;

    let providerCallStarted = false;

    let providerTransactionReferenceId: string | null = null;

    let providerTransactionId: string | null = null;

    let merchantRefId: string | null = null;

    let result: Awaited<ReturnType<VimopayService['cashWithdrawal']>>;

    /*
     * =====================================================
     * 4. PRE-PROVIDER + PROVIDER CALL
     * =====================================================
     */

    try {
      /*
       * ===================================================
       * >5000 CWTFA
       * ===================================================
       */

      if (amount > 5000) {
        const authorization =
          await this.prisma.vimopayTxnAuthorization.findFirst({
            where: {
              id: dto.authRequestId!,

              profileId: merchant.profileId,

              type: VimopayTxnAuthType.CASH_WITHDRAWAL,
            },
          });

        if (!authorization) {
          throw new BadRequestException(
            'Cash Withdrawal authorization is invalid',
          );
        }

        if (authorization.status !== VimopayTxnAuthStatus.ISSUED) {
          throw new BadRequestException(
            `Cash Withdrawal authorization is ${authorization.status.toLowerCase()}`,
          );
        }

        if (authorization.expiresAt <= new Date()) {
          await this.prisma.vimopayTxnAuthorization.update({
            where: {
              id: authorization.id,
            },

            data: {
              status: VimopayTxnAuthStatus.EXPIRED,
            },
          });

          throw new BadRequestException(
            'Cash Withdrawal authorization has expired',
          );
        }

        if (Number(authorization.amount) !== amount) {
          throw new BadRequestException(
            'Cash Withdrawal amount does not match the transaction authorization',
          );
        }

        if (authorization.bankIIN !== dto.bankIIN) {
          throw new BadRequestException(
            'Bank IIN does not match the transaction authorization',
          );
        }

        if (authorization.aadhaarLast4 !== dto.aadhaarNumber.slice(-4)) {
          throw new BadRequestException(
            'Aadhaar does not match the transaction authorization',
          );
        }

        if (!authorization.providerTxnRefId) {
          throw new BadRequestException(
            'Provider transaction authorization is missing',
          );
        }

        /*
         * Atomic claim.
         */

        const claimed = await this.prisma.vimopayTxnAuthorization.updateMany({
          where: {
            id: authorization.id,

            status: VimopayTxnAuthStatus.ISSUED,
          },

          data: {
            status: VimopayTxnAuthStatus.CONSUMING,

            consumingAt: new Date(),
          },
        });

        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Cash Withdrawal authorization has already been used',
          );
        }

        claimedAuthorizationId = authorization.id;

        cwAuthTxnId = authorization.providerTxnRefId;
      }

      /*
       * ===================================================
       * 5. CANONICAL PTXN
       * ===================================================
       */

      const providerTransaction = await this.providerTransactionService.create({
        userId: context.identityId,

        serviceType: 'AEPS',

        provider: 'VIMOPAY',

        operation: 'CW',

        /*
         * IMPORTANT:
         * Authenticated business role
         * explicitly persisted.
         */
        sourceRole,

        /*
         * FULL actual amount.
         */
        amount,

        settlementRequired: true,

        idempotencyKey,

        merchantProfileId: merchant.profileId,

        providerMerchantId: merchant.merchantId,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),

        metadata: {
          category: 'FINANCIAL',

          transactionOtpRequired: amount > 5000,

          /*
           * Commission/income does NOT
           * reduce principal anymore.
           */
          incomeModel: 'PROVIDER_INCOME',

          ...(dto.authRequestId
            ? {
                authRequestId: dto.authRequestId,
              }
            : {}),
        },
      });

      providerTransactionReferenceId = providerTransaction.referenceId;

      providerTransactionId = providerTransaction.id;

      /*
       * ===================================================
       * 6. PROVIDER REF
       * ===================================================
       */

      merchantRefId = this.generateMerchantRefId('CW');

      await this.providerTransactionService.markProcessing(
        providerTransaction.referenceId,

        merchantRefId,
      );

      /*
       * ===================================================
       * 7. VIMOPAY DTO
       * ===================================================
       */

      const providerDto: VimopayCashWithdrawalDto = {
        merchantRefId,

        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        /*
         * FULL transaction amount.
         *
         * No commission deduction.
         */
        amount: amount.toFixed(2),

        bankIIN: dto.bankIIN,

        ipAddress: context.ipAddress,

        lat: dto.lat,

        long: dto.long,

        deviceType: dto.deviceType,

        cwAuthTxnId,

        udf1: dto.udf1 ?? '',

        udf2: dto.udf2 ?? '',

        udf3: dto.udf3 ?? '',

        pidData: dto.pidData,
      };

      /*
       * ===================================================
       * 8. PROVIDER CALL
       * ===================================================
       */

      providerCallStarted = true;

      result = await this.vimopayService.cashWithdrawal(providerDto);
    } catch (error) {
      /*
       * ===================================================
       * PROVIDER CALL NOT STARTED
       * ===================================================
       */

      if (!providerCallStarted) {
        if (claimedAuthorizationId) {
          await this.prisma.vimopayTxnAuthorization.updateMany({
            where: {
              id: claimedAuthorizationId,

              status: VimopayTxnAuthStatus.CONSUMING,
            },

            data: {
              status: VimopayTxnAuthStatus.ISSUED,

              consumingAt: null,
            },
          });
        }

        await this.idempotencyService.abandonBeforeProvider(
          idempotency.recordId,

          idempotency.lockToken,
        );

        throw error;
      }

      /*
       * ===================================================
       * PROVIDER CALL STARTED → UNKNOWN
       * ===================================================
       */

      await this.idempotencyService.markUnknown(
        idempotency.recordId,
        idempotency.lockToken,
        merchantRefId ?? undefined,
      );

      if (claimedAuthorizationId) {
        await this.prisma.vimopayTxnAuthorization.updateMany({
          where: {
            id: claimedAuthorizationId,

            status: VimopayTxnAuthStatus.CONSUMING,
          },

          data: {
            status: VimopayTxnAuthStatus.UNKNOWN,
          },
        });
      }

      if (providerTransactionReferenceId) {
        try {
          await this.providerTransactionService.markUnknown({
            referenceId: providerTransactionReferenceId,

            providerMerchantRefId: merchantRefId ?? undefined,

            reason:
              error instanceof Error
                ? error.message
                : 'VimoPay Cash Withdrawal request failed',
          });
        } catch {
          /*
           * Preserve provider error.
           */
        }
      }

      throw error;
    }

    /*
     * =====================================================
     * 9. CONSUME HIGH VALUE AUTH
     * =====================================================
     */

    if (amount > 5000 && claimedAuthorizationId) {
      try {
        await this.prisma.vimopayTxnAuthorization.update({
          where: {
            id: claimedAuthorizationId,
          },

          data: {
            status: VimopayTxnAuthStatus.CONSUMED,

            consumedAt: new Date(),

            providerStatusCode: result.status,

            providerStatusMessage: result.statusDescription,
          },
        });
      } catch (error) {
        this.logger.error(
          'Cash Withdrawal provider authorization finalization failed',

          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    /*
     * =====================================================
     * 10. FINALIZE PROVIDER TRANSACTION
     * =====================================================
     */

    const finalStatus = this.mapProviderTransactionStatus(result.status);

    try {
      if (finalStatus) {
        await this.providerTransactionService.finalize({
          referenceId: providerTransactionReferenceId!,

          status: finalStatus,

          providerMerchantRefId: merchantRefId!,

          providerTxnRefId: result.txnRefId,

          rrn: result.rrn,

          npciCode: result.npciCode,

          npciMessage: result.npciMessage,

          providerStatusCode: result.status,

          providerStatusMessage: result.statusDescription,

          metadata: {
            category: 'FINANCIAL',

            transactionOtpRequired: amount > 5000,

            principalAmount: amount.toFixed(2),

            incomeModel: 'PROVIDER_INCOME',
            ...this.getSafeReceiptMetadata(result),
          },
        });
      } else {
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransactionReferenceId!,

          providerMerchantRefId: merchantRefId!,

          reason: `Unexpected VimoPay transaction status: ${result.status}`,
        });
      }
    } catch (error) {
      this.logger.error(
        'Unable to finalize canonical Cash Withdrawal transaction',

        error instanceof Error ? error.stack : undefined,
      );
    }

    /*
     * =====================================================
     * 11. FULL PRINCIPAL SETTLEMENT
     * =====================================================
     */

    let settlementStatus: 'NOT_REQUIRED' | 'PENDING' | 'SETTLED' =
      result.status === '001' || result.status === '003'
        ? 'NOT_REQUIRED'
        : 'PENDING';

    let settlementTransactionReference: string | null = null;

    if (result.status === '000') {
      try {
        const settlement = await this.walletService.settlePrincipal({
          userId: context.identityId,

          providerTransactionReference: providerTransactionReferenceId!,

          operation: 'CW',

          /*
           * FULL transaction amount.
           */
          grossAmount: amount,

          netAmount: amount,
        });

        settlementStatus = 'SETTLED';

        settlementTransactionReference = settlement.referenceId;
      } catch (error) {
        settlementStatus = 'PENDING';

        this.logger.error(
          'CW provider success but full AEPS principal settlement is pending',

          error instanceof Error ? error.stack : undefined,
        );

        try {
          await this.providerTransactionService.markFinancialRecoveryRequired(
            providerTransactionReferenceId!,

            error instanceof Error
              ? `CW principal settlement pending: ${error.message}`
              : 'CW principal settlement pending',
          );
        } catch (trackingError) {
          this.logger.error(
            'Unable to mark CW financial recovery required',

            trackingError instanceof Error ? trackingError.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * 12. PROVIDER INCOME
     * =====================================================
     */

    let providerIncomeAmount: number | null = null;

    let incomeSource: string | null = null;

    let commissionResult: AepsCommissionSettlementResult = {
      status: 'NOT_REQUIRED',

      amount: null,

      grossAmount: amount.toFixed(2),

      netAmount: amount.toFixed(2),

      commissionReference: null,

      walletTransactionReference: null,

      distributions: [],

      reason:
        result.status === '000'
          ? 'WAITING_FOR_PRINCIPAL_SETTLEMENT'
          : 'PROVIDER_TRANSACTION_NOT_SUCCESSFUL',
    };

    /*
     * Provider income processing only after:
     *
     * provider SUCCESS
     * +
     * principal SETTLED
     */

    if (
      result.status === '000' &&
      settlementStatus === 'SETTLED' &&
      providerTransactionId
    ) {
      try {
        const income =
          this.vimopayIncomeService.resolveForSuccessfulTransaction(amount);

        /*
         * ===================================================
         * PRODUCTION:
         * WAIT FOR PROVIDER WALLET INCOME
         * ===================================================
         */

        if (!income.available) {
          providerIncomeAmount = null;

          incomeSource = null;

          await this.providerTransactionService.updateCommissionState({
            referenceId: providerTransactionReferenceId!,

            status: 'WAITING_PROVIDER_INCOME',

            failureReason:
              income.reason ?? 'Waiting for VimoPay provider income',
          });

          commissionResult = {
            status: 'PENDING',

            amount: null,

            grossAmount: amount.toFixed(2),

            netAmount: amount.toFixed(2),

            commissionReference: null,

            walletTransactionReference: null,

            distributions: [],

            reason: 'WAITING_FOR_PROVIDER_INCOME',
          };
        } else {
          /*
           * ===================================================
           * UAT / PROVIDER INCOME AVAILABLE
           * ===================================================
           */

          if (
            income.amount === null ||
            !Number.isFinite(income.amount) ||
            income.amount < 0
          ) {
            throw new Error('Resolved VimoPay income amount is invalid');
          }

          if (!income.source) {
            throw new Error('Resolved VimoPay income source is missing');
          }

          providerIncomeAmount = income.amount;

          incomeSource = income.source;

          /*
           * Existing provider-funded
           * commission engine.
           */
          commissionResult = await this.commissionService.settleProviderIncome({
            providerTransactionId,

            providerTransactionReference: providerTransactionReferenceId!,

            userId: context.identityId,

            /*
             * IMPORTANT:
             * Frozen authenticated role.
             */
            role: sourceRole,

            operation: 'CW',

            transactionAmount: amount,

            providerIncomeAmount: income.amount,

            incomeSource: income.source,
          });
        }
      } catch (error) {
        commissionResult = {
          status: 'PENDING',

          amount:
            providerIncomeAmount !== null
              ? providerIncomeAmount.toFixed(2)
              : null,

          grossAmount: amount.toFixed(2),

          netAmount: amount.toFixed(2),

          commissionReference: null,

          walletTransactionReference: null,

          distributions: [],

          reason: 'PROVIDER_INCOME_SETTLEMENT_PENDING',
        };

        this.logger.error(
          `CW provider income settlement pending for ${providerTransactionReferenceId}`,

          error instanceof Error ? error.stack : undefined,
        );

        try {
          await this.providerTransactionService.updateCommissionState({
            referenceId: providerTransactionReferenceId!,

            status: 'PENDING',

            ...(providerIncomeAmount !== null
              ? {
                  commissionAmount: providerIncomeAmount,
                }
              : {}),

            failureReason:
              error instanceof Error
                ? error.message
                : 'Provider income settlement failed',
          });
        } catch (stateError) {
          this.logger.error(
            `Unable to persist CW commission pending state for ${providerTransactionReferenceId}`,

            stateError instanceof Error ? stateError.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * PROVIDER ITSELF PENDING
     * =====================================================
     */

    if (result.status === '002') {
      commissionResult = {
        status: 'PENDING',

        amount: null,

        grossAmount: amount.toFixed(2),

        netAmount: amount.toFixed(2),

        commissionReference: null,

        walletTransactionReference: null,

        distributions: [],

        reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
      };
    }

    /*
     * =====================================================
     * 13. RESPONSE
     * =====================================================
     */

    const response = {
      provider: 'VIMOPAY',

      transactionType: 'CW',

      transactionReferenceId: providerTransactionReferenceId!,

      profileId: merchant.profileId,

      merchantRefId: merchantRefId!,

      providerMerchantId: merchant.merchantId,

      amount: amount.toFixed(2),

      accounting: {
        transactionAmount: amount.toFixed(2),

        principalAmount: amount.toFixed(2),

        providerIncomeAmount:
          providerIncomeAmount !== null
            ? providerIncomeAmount.toFixed(2)
            : null,

        incomeSource,
      },

      result,

      settlement: {
        status: settlementStatus,

        walletType: result.status === '000' ? 'AEPS' : null,

        amount: result.status === '000' ? amount.toFixed(2) : null,

        transactionReference: settlementTransactionReference,
      },

      commission: commissionResult,
    };

    /*
     * =====================================================
     * 14. IDEMPOTENCY COMPLETE
     * =====================================================
     */

    try {
      await this.idempotencyService.complete({
        recordId: idempotency.recordId,

        lockToken: idempotency.lockToken,

        response,

        providerStatusCode: result.status,

        providerMerchantRefId: merchantRefId!,

        providerTxnRefId: result.txnRefId,
      });
    } catch (error) {
      this.logger.error(
        'Cash Withdrawal idempotency finalization failed',

        error instanceof Error ? error.stack : undefined,
      );
    }

    return response;
  }

  /*
   * =====================================================
   * REFERENCE GENERATOR
   * =====================================================
   */

  private generateMerchantRefId(transactionType: string): string {
    return `VMP${transactionType}${Date.now()}${randomInt(100000, 1000000)}`;
  }

  async sendCashWithdrawalOtp(
    context: VimopayTransactionContext,
    dto: VimopayCashWithdrawalOtpRequestDto,
  ) {
    const merchant = await this.accessService.getActiveMerchant(
      context.identityId,
    );

    const amount = Number(dto.amount);

    if (!Number.isFinite(amount) || amount <= 5000 || amount > 10000) {
      throw new BadRequestException(
        'Cash Withdrawal transaction OTP is required only for amount above 5000 and up to 10000',
      );
    }

    const merchantRefId = this.generateMerchantRefId('CWO');

    const providerDto: VimopayAepsTransactionOtpDto = {
      merchantRefId,

      merchantId: merchant.merchantId,

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,

      transactionType: 'CWTFA',

      amount: dto.amount,

      mobileNumber: dto.mobileNumber,

      custMobileNumber: dto.custMobileNumber ?? '',

      lat: dto.lat,

      long: dto.long,

      ipAddress: context.ipAddress,

      appPlatform: dto.appPlatform,

      appVersion: dto.appVersion,
    };

    const result =
      await this.vimopayService.sendAepsTransactionOtp(providerDto);

    if (result.status !== '000' || !result.txnRefId) {
      throw new BadRequestException(
        result.statusDescription ||
          'Unable to generate Cash Withdrawal transaction authorization',
      );
    }

    const ttlMinutes = Number(
      this.configService.get('AEPS_VIMO_TXN_AUTH_TTL_MINUTES') ?? 10,
    );

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    /*
     * New CWTFA successfully issued.
     *
     * Purani unused CW authorizations
     * invalidate kar denge.
     */
    await this.txnAuthCleanupService.expirePreviousIssued(
      merchant.profileId,

      VimopayTxnAuthType.CASH_WITHDRAWAL,
    );

    const authorization = await this.prisma.vimopayTxnAuthorization.create({
      data: {
        profileId: merchant.profileId,

        type: VimopayTxnAuthType.CASH_WITHDRAWAL,

        status: VimopayTxnAuthStatus.ISSUED,

        clientRefId: merchantRefId,

        providerTxnRefId: result.txnRefId,

        amount: dto.amount,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),

        providerStatusCode: result.status,

        providerStatusMessage: result.statusDescription,

        expiresAt,
      },
    });

    return {
      provider: 'VIMOPAY',

      transactionType: 'CWTFA',

      authRequestId: authorization.id,

      amount: dto.amount,

      bankIIN: dto.bankIIN,

      expiresAt,

      message: result.npciMessage || result.statusDescription,

      nextAction: 'CAPTURE_BIOMETRIC_WITH_OTP',
    };
  }

  async sendAadhaarPayOtp(
    context: VimopayTransactionContext,
    dto: VimopayAadhaarPayOtpRequestDto,
  ) {
    const merchant = await this.accessService.getActiveMerchant(
      context.identityId,
    );

    const amount = Number(dto.amount);

    if (!Number.isFinite(amount) || amount <= 5000 || amount > 10000) {
      throw new BadRequestException(
        'Aadhaar Pay transaction OTP is required only for amount above 5000 and up to 10000',
      );
    }

    const merchantRefId = this.generateMerchantRefId('APO');

    const result = await this.vimopayService.sendAepsTransactionOtp({
      merchantRefId,

      merchantId: merchant.merchantId,

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,

      transactionType: 'APTFA',

      amount: dto.amount,

      mobileNumber: dto.mobileNumber,

      custMobileNumber: dto.custMobileNumber ?? '',

      lat: dto.lat,

      long: dto.long,

      ipAddress: context.ipAddress,

      appPlatform: dto.appPlatform,

      appVersion: dto.appVersion,
    });

    if (result.status !== '000' || !result.txnRefId) {
      throw new BadRequestException(
        result.statusDescription ||
          'Unable to create Aadhaar Pay transaction authorization',
      );
    }

    const ttlMinutes = Number(
      this.configService.get('AEPS_VIMO_TXN_AUTH_TTL_MINUTES') ?? 10,
    );

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const authorization = await this.prisma.vimopayTxnAuthorization.create({
      data: {
        profileId: merchant.profileId,

        type: VimopayTxnAuthType.AADHAAR_PAY,

        status: VimopayTxnAuthStatus.ISSUED,

        clientRefId: merchantRefId,

        providerTxnRefId: result.txnRefId,

        amount: dto.amount,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),

        providerStatusCode: result.status,

        providerStatusMessage: result.statusDescription,

        expiresAt,
      },
    });

    return {
      provider: 'VIMOPAY',

      transactionType: 'APTFA',

      authRequestId: authorization.id,

      amount: dto.amount,

      bankIIN: dto.bankIIN,

      expiresAt,

      message: result.npciMessage || result.statusDescription,

      nextAction: 'CAPTURE_BIOMETRIC_WITH_OTP',
    };
  }

  async aadhaarPay(
    context: VimopayTransactionContext,
    dto: VimopayAadhaarPayRequestDto,
    idempotencyKey: string,
  ) {
    /*
     * =====================================================
     * 1. ACTIVE MERCHANT + DAILY 2FA
     * =====================================================
     */

    const merchant = await this.accessService.getActiveMerchant(
      context.identityId,
    );

    /*
     * Financial transaction ke liye
     * authenticated business role mandatory.
     *
     * Ye role PTXN mein freeze hoga aur
     * delayed provider-income reconciliation
     * mein later same role use hoga.
     */
    const sourceRole = this.requireFinancialSourceRole(context);

    const amount = Number(dto.amount);

    if (!Number.isFinite(amount) || amount < 100 || amount > 10000) {
      throw new BadRequestException(
        'Aadhaar Pay amount must be between 100 and 10000',
      );
    }

    /*
     * <= 5000:
     * transaction OTP nahi.
     */
    if (amount <= 5000 && dto.authRequestId) {
      throw new BadRequestException(
        'authRequestId must not be provided for Aadhaar Pay up to 5000',
      );
    }

    /*
     * > 5000:
     * APTFA mandatory.
     */
    if (amount > 5000 && !dto.authRequestId) {
      throw new BadRequestException({
        message: 'Aadhaar Pay above 5000 requires transaction authorization',

        code: 'VIMOPAY_AP_TRANSACTION_OTP_REQUIRED',
      });
    }

    /*
     * =====================================================
     * 2. IDEMPOTENCY
     * =====================================================
     *
     * requestHash:
     * exact request replay protection.
     *
     * intentHash:
     * same logical financial transaction
     * with another Idempotency-Key protection.
     */

    const requestHash = this.idempotencyService.createRequestHash({
      transactionType: 'AP',

      amount: amount.toFixed(2),

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,

      mobileNumber: dto.mobileNumber,

      /*
       * High-value transaction mein
       * exact authorization bhi request
       * fingerprint ka part hoga.
       */
      authRequestId: dto.authRequestId ?? null,
    });

    /*
     * Stable financial intent.
     *
     * PID data nahi.
     * IP nahi.
     * merchantRefId nahi.
     * fresh biometric data nahi.
     * authRequestId nahi.
     */
    const intentHash = this.idempotencyService.createIntentHash({
      transactionType: 'AP',

      amount: amount.toFixed(2),

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,
    });

    const idempotency = await this.idempotencyService.begin({
      identityId: context.identityId,

      profileId: merchant.profileId,

      transactionType: AepsFinancialTransactionType.AADHAAR_PAY,

      idempotencyKey,

      requestHash,

      intentHash,
    });

    /*
     * Same key already completed.
     *
     * Provider dobara call nahi hoga.
     */
    if (!idempotency.shouldExecute) {
      return idempotency.response;
    }

    /*
     * =====================================================
     * 3. INTERNAL STATE
     * =====================================================
     */

    let cwAuthTxnId = '';

    let claimedAuthorizationId: string | null = null;

    let providerCallStarted = false;

    let providerTransactionReferenceId: string | null = null;

    let providerTransactionId: string | null = null;

    let merchantRefId: string | null = null;

    let result: Awaited<ReturnType<VimopayService['aadhaarPay']>>;

    /*
     * =====================================================
     * 4. PRE-PROVIDER + PROVIDER CALL
     * =====================================================
     */

    try {
      /*
       * ===================================================
       * >5000 APTFA AUTHORIZATION
       * ===================================================
       */

      if (amount > 5000) {
        const authorization =
          await this.prisma.vimopayTxnAuthorization.findFirst({
            where: {
              id: dto.authRequestId!,

              profileId: merchant.profileId,

              type: VimopayTxnAuthType.AADHAAR_PAY,
            },
          });

        if (!authorization) {
          throw new BadRequestException('Aadhaar Pay authorization is invalid');
        }

        if (authorization.status !== VimopayTxnAuthStatus.ISSUED) {
          throw new BadRequestException(
            `Aadhaar Pay authorization is ${authorization.status.toLowerCase()}`,
          );
        }

        /*
         * Authorization expired.
         */
        if (authorization.expiresAt <= new Date()) {
          await this.prisma.vimopayTxnAuthorization.update({
            where: {
              id: authorization.id,
            },

            data: {
              status: VimopayTxnAuthStatus.EXPIRED,
            },
          });

          throw new BadRequestException(
            'Aadhaar Pay authorization has expired',
          );
        }

        /*
         * Authorization must match
         * exact transaction intent.
         */

        if (Number(authorization.amount) !== amount) {
          throw new BadRequestException(
            'Aadhaar Pay amount does not match authorization',
          );
        }

        if (authorization.bankIIN !== dto.bankIIN) {
          throw new BadRequestException(
            'Bank IIN does not match authorization',
          );
        }

        if (authorization.aadhaarLast4 !== dto.aadhaarNumber.slice(-4)) {
          throw new BadRequestException('Aadhaar does not match authorization');
        }

        if (!authorization.providerTxnRefId) {
          throw new BadRequestException(
            'Provider transaction authorization is missing',
          );
        }

        /*
         * Atomic authorization claim.
         *
         * ISSUED -> CONSUMING
         */

        const claimed = await this.prisma.vimopayTxnAuthorization.updateMany({
          where: {
            id: authorization.id,

            status: VimopayTxnAuthStatus.ISSUED,
          },

          data: {
            status: VimopayTxnAuthStatus.CONSUMING,

            consumingAt: new Date(),
          },
        });

        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Aadhaar Pay authorization has already been used',
          );
        }

        claimedAuthorizationId = authorization.id;

        /*
         * VimoPay APTFA txnRefId.
         */
        cwAuthTxnId = authorization.providerTxnRefId;
      }

      /*
       * ===================================================
       * 5. CANONICAL PROVIDER TRANSACTION
       * ===================================================
       *
       * PTXN amount = FULL AP amount.
       *
       * Provider income principal se
       * deduct nahi hogi.
       */

      const providerTransaction = await this.providerTransactionService.create({
        userId: context.identityId,

        serviceType: 'AEPS',

        provider: 'VIMOPAY',

        operation: 'AP',

        /*
         * IMPORTANT:
         * Persist authenticated role.
         */
        sourceRole,

        amount,

        settlementRequired: true,

        idempotencyKey,

        merchantProfileId: merchant.profileId,

        providerMerchantId: merchant.merchantId,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),

        metadata: {
          category: 'FINANCIAL',

          transactionOtpRequired: amount > 5000,

          incomeModel: 'PROVIDER_INCOME',

          ...(dto.authRequestId
            ? {
                authRequestId: dto.authRequestId,
              }
            : {}),
        },
      });

      providerTransactionId = providerTransaction.id;

      providerTransactionReferenceId = providerTransaction.referenceId;

      /*
       * ===================================================
       * 6. PROVIDER MERCHANT REF
       * ===================================================
       */

      merchantRefId = this.generateMerchantRefId('AP');

      await this.providerTransactionService.markProcessing(
        providerTransaction.referenceId,

        merchantRefId,
      );

      /*
       * ===================================================
       * 7. VIMOPAY DTO
       * ===================================================
       */

      const providerDto: VimopayAadhaarPayDto = {
        merchantRefId,

        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        /*
         * FULL transaction amount.
         */
        amount: amount.toFixed(2),

        bankIIN: dto.bankIIN,

        ipAddress: context.ipAddress,

        lat: dto.lat,

        long: dto.long,

        deviceType: dto.deviceType,

        /*
         * <= 5000:
         * ''
         *
         * > 5000:
         * APTFA provider txnRefId
         */
        cwAuthTxnId,

        udf1: dto.udf1 ?? '',

        udf2: dto.udf2 ?? '',

        udf3: dto.udf3 ?? '',

        pidData: dto.pidData,
      };

      /*
       * ===================================================
       * 8. PROVIDER CALL
       * ===================================================
       */

      providerCallStarted = true;

      result = await this.vimopayService.aadhaarPay(providerDto);
    } catch (error) {
      /*
       * ===================================================
       * PROVIDER CALL NOT STARTED
       * ===================================================
       *
       * Safe to release:
       *
       * - authorization claim
       * - idempotency reservation
       */

      if (!providerCallStarted) {
        if (claimedAuthorizationId) {
          await this.prisma.vimopayTxnAuthorization.updateMany({
            where: {
              id: claimedAuthorizationId,

              status: VimopayTxnAuthStatus.CONSUMING,
            },

            data: {
              status: VimopayTxnAuthStatus.ISSUED,

              consumingAt: null,
            },
          });
        }

        await this.idempotencyService.abandonBeforeProvider(
          idempotency.recordId,

          idempotency.lockToken,
        );

        throw error;
      }

      /*
       * ===================================================
       * PROVIDER CALL STARTED → UNKNOWN
       * ===================================================
       *
       * Never auto retry provider.
       */

      await this.idempotencyService.markUnknown(
        idempotency.recordId,

        idempotency.lockToken,

        /*
         * Preserve generated provider ref
         * for later reconciliation.
         */
        merchantRefId ?? undefined,
      );

      if (claimedAuthorizationId) {
        await this.prisma.vimopayTxnAuthorization.updateMany({
          where: {
            id: claimedAuthorizationId,

            status: VimopayTxnAuthStatus.CONSUMING,
          },

          data: {
            status: VimopayTxnAuthStatus.UNKNOWN,
          },
        });
      }

      if (providerTransactionReferenceId) {
        try {
          await this.providerTransactionService.markUnknown({
            referenceId: providerTransactionReferenceId,

            providerMerchantRefId: merchantRefId ?? undefined,

            reason:
              error instanceof Error
                ? error.message
                : 'VimoPay Aadhaar Pay request failed',
          });
        } catch {
          /*
           * Preserve original provider error.
           */
        }
      }

      throw error;
    }

    /*
     * =====================================================
     * 9. FINALIZE HIGH VALUE AUTHORIZATION
     * =====================================================
     */

    if (amount > 5000 && claimedAuthorizationId) {
      try {
        await this.prisma.vimopayTxnAuthorization.update({
          where: {
            id: claimedAuthorizationId,
          },

          data: {
            status: VimopayTxnAuthStatus.CONSUMED,

            consumedAt: new Date(),

            providerStatusCode: result.status,

            providerStatusMessage: result.statusDescription,
          },
        });
      } catch (error) {
        this.logger.error(
          'Aadhaar Pay authorization finalization failed',

          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    /*
     * =====================================================
     * 10. FINALIZE PROVIDER TRANSACTION
     * =====================================================
     */

    const finalStatus = this.mapProviderTransactionStatus(result.status);

    try {
      if (finalStatus) {
        await this.providerTransactionService.finalize({
          referenceId: providerTransactionReferenceId!,

          status: finalStatus,

          providerMerchantRefId: merchantRefId!,

          providerTxnRefId: result.txnRefId,

          rrn: result.rrn,

          npciCode: result.npciCode,

          npciMessage: result.npciMessage,

          providerStatusCode: result.status,

          providerStatusMessage: result.statusDescription,

          metadata: {
            category: 'FINANCIAL',

            transactionOtpRequired: amount > 5000,

            /*
             * FULL AP principal.
             */
            principalAmount: amount.toFixed(2),

            incomeModel: 'PROVIDER_INCOME',

            ...this.getSafeReceiptMetadata(result),
          },
        });
      } else {
        /*
         * Unexpected provider result.
         */
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransactionReferenceId!,

          providerMerchantRefId: merchantRefId!,

          reason: `Unexpected VimoPay transaction status: ${result.status}`,
        });
      }
    } catch (error) {
      /*
       * Provider response already received.
       *
       * Do not re-call provider.
       */
      this.logger.error(
        'Unable to finalize canonical Aadhaar Pay transaction',

        error instanceof Error ? error.stack : undefined,
      );
    }

    /*
     * =====================================================
     * 11. FULL PRINCIPAL SETTLEMENT
     * =====================================================
     *
     * AP ₹500 SUCCESS:
     *
     * AEPS wallet +₹500
     *
     * Provider income separately.
     */

    let settlementStatus: 'NOT_REQUIRED' | 'PENDING' | 'SETTLED' =
      result.status === '001' || result.status === '003'
        ? 'NOT_REQUIRED'
        : 'PENDING';

    let settlementTransactionReference: string | null = null;

    if (result.status === '000') {
      try {
        const settlement = await this.walletService.settlePrincipal({
          userId: context.identityId,

          providerTransactionReference: providerTransactionReferenceId!,

          operation: 'AP',

          /*
           * FULL principal.
           */
          grossAmount: amount,

          netAmount: amount,
        });

        settlementStatus = 'SETTLED';

        settlementTransactionReference = settlement.referenceId;
      } catch (error) {
        settlementStatus = 'PENDING';

        this.logger.error(
          'AP provider success but full AEPS principal settlement is pending',

          error instanceof Error ? error.stack : undefined,
        );

        try {
          await this.providerTransactionService.markFinancialRecoveryRequired(
            providerTransactionReferenceId!,

            error instanceof Error
              ? `AP principal settlement pending: ${error.message}`
              : 'AP principal settlement pending',
          );
        } catch (trackingError) {
          this.logger.error(
            'Unable to mark AP financial recovery required',

            trackingError instanceof Error ? trackingError.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * 12. PROVIDER INCOME
     * =====================================================
     */

    let providerIncomeAmount: number | null = null;

    let incomeSource: string | null = null;

    let commissionResult: AepsCommissionSettlementResult = {
      status: result.status === '000' ? 'PENDING' : 'NOT_REQUIRED',

      amount: null,

      grossAmount: amount.toFixed(2),

      /*
       * Provider income does not
       * reduce AP principal.
       */
      netAmount: amount.toFixed(2),

      commissionReference: null,

      walletTransactionReference: null,

      distributions: [],

      reason:
        result.status === '000'
          ? 'WAITING_FOR_PRINCIPAL_SETTLEMENT'
          : 'PROVIDER_TRANSACTION_NOT_SUCCESSFUL',
    };

    /*
     * Provider income only after:
     *
     * provider SUCCESS
     * +
     * principal SETTLED
     */

    if (
      result.status === '000' &&
      settlementStatus === 'SETTLED' &&
      providerTransactionId
    ) {
      try {
        const income =
          this.vimopayIncomeService.resolveForSuccessfulTransaction(amount);

        /*
         * =================================================
         * PRODUCTION:
         * provider wallet income later.
         * =================================================
         */

        if (!income.available) {
          providerIncomeAmount = null;

          incomeSource = null;

          await this.providerTransactionService.updateCommissionState({
            referenceId: providerTransactionReferenceId!,

            status: 'WAITING_PROVIDER_INCOME',

            failureReason:
              income.reason ?? 'Waiting for VimoPay provider income',
          });

          commissionResult = {
            status: 'PENDING',

            amount: null,

            grossAmount: amount.toFixed(2),

            netAmount: amount.toFixed(2),

            commissionReference: null,

            walletTransactionReference: null,

            distributions: [],

            reason: 'WAITING_FOR_PROVIDER_INCOME',
          };
        } else {
          /*
           * =================================================
           * UAT / PROVIDER INCOME AVAILABLE
           * =================================================
           */

          if (
            income.amount === null ||
            !Number.isFinite(income.amount) ||
            income.amount < 0
          ) {
            throw new Error('Resolved VimoPay income amount is invalid');
          }

          if (!income.source) {
            throw new Error('Resolved VimoPay income source is missing');
          }

          providerIncomeAmount = income.amount;

          incomeSource = income.source;

          /*
           * Provider-funded commission
           * distribution.
           */
          commissionResult = await this.commissionService.settleProviderIncome({
            providerTransactionId,

            providerTransactionReference: providerTransactionReferenceId!,

            userId: context.identityId,

            /*
             * IMPORTANT:
             * Persisted/frozen source role.
             */
            role: sourceRole,

            operation: 'AP',

            transactionAmount: amount,

            providerIncomeAmount: income.amount,

            incomeSource: income.source,
          });
        }
      } catch (error) {
        commissionResult = {
          status: 'PENDING',

          amount:
            providerIncomeAmount !== null
              ? providerIncomeAmount.toFixed(2)
              : null,

          grossAmount: amount.toFixed(2),

          netAmount: amount.toFixed(2),

          commissionReference: null,

          walletTransactionReference: null,

          distributions: [],

          reason: 'PROVIDER_INCOME_SETTLEMENT_PENDING',
        };

        this.logger.error(
          `AP provider income settlement pending for ${providerTransactionReferenceId}`,

          error instanceof Error ? error.stack : undefined,
        );

        try {
          await this.providerTransactionService.updateCommissionState({
            referenceId: providerTransactionReferenceId!,

            status: 'PENDING',

            ...(providerIncomeAmount !== null
              ? {
                  commissionAmount: providerIncomeAmount,
                }
              : {}),

            failureReason:
              error instanceof Error
                ? error.message
                : 'Provider income settlement failed',
          });
        } catch (stateError) {
          this.logger.error(
            `Unable to persist AP commission pending state for ${providerTransactionReferenceId}`,

            stateError instanceof Error ? stateError.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * PROVIDER PENDING
     * =====================================================
     */

    if (result.status === '002') {
      commissionResult = {
        status: 'PENDING',

        amount: null,

        grossAmount: amount.toFixed(2),

        netAmount: amount.toFixed(2),

        commissionReference: null,

        walletTransactionReference: null,

        distributions: [],

        reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
      };
    }

    /*
     * =====================================================
     * 13. RESPONSE
     * =====================================================
     */

    const response = {
      provider: 'VIMOPAY',

      transactionType: 'AP',

      transactionReferenceId: providerTransactionReferenceId!,

      profileId: merchant.profileId,

      merchantRefId: merchantRefId!,

      providerMerchantId: merchant.merchantId,

      /*
       * FULL AP amount.
       */
      amount: amount.toFixed(2),

      accounting: {
        transactionAmount: amount.toFixed(2),

        principalAmount: amount.toFixed(2),

        providerIncomeAmount:
          providerIncomeAmount !== null
            ? providerIncomeAmount.toFixed(2)
            : null,

        incomeSource,
      },

      result,

      settlement: {
        status: settlementStatus,

        walletType: result.status === '000' ? 'AEPS' : null,

        amount: result.status === '000' ? amount.toFixed(2) : null,

        transactionReference: settlementTransactionReference,
      },

      commission: commissionResult,
    };

    /*
     * =====================================================
     * 14. IDEMPOTENCY COMPLETE
     * =====================================================
     */

    try {
      await this.idempotencyService.complete({
        recordId: idempotency.recordId,

        lockToken: idempotency.lockToken,

        response,

        providerStatusCode: result.status,

        providerMerchantRefId: merchantRefId!,

        providerTxnRefId: result.txnRefId,
      });
    } catch (error) {
      this.logger.error(
        'Aadhaar Pay idempotency finalization failed',

        error instanceof Error ? error.stack : undefined,
      );
    }

    return response;
  }

  /*
   * =====================================================
   * CASH DEPOSIT
   * =====================================================
   */
  private mapProviderTransactionStatus(
    providerStatus: string,
  ): 'SUCCESS' | 'FAILED' | 'PENDING' | null {
    switch (providerStatus) {
      case '000':
        return 'SUCCESS';

      case '001':
      case '003':
        return 'FAILED';

      case '002':
        return 'PENDING';

      default:
        return null;
    }
  }

  async reconcileProviderIncome(
    input: VimopayProviderIncomeReconciliationInput,
  ) {
    /*
     * =====================================================
     * 1. VALIDATION
     * =====================================================
     */

    if (!input.referenceId?.trim()) {
      throw new BadRequestException(
        'Provider transaction reference is required',
      );
    }

    if (!input.reconciledBy?.trim()) {
      throw new BadRequestException('reconciledBy is required');
    }

    /*
     * =====================================================
     * 2. CANONICAL PROVIDER TRANSACTION
     * =====================================================
     */

    const transaction: any = await this.providerTransactionService.get(
      input.referenceId,
    );

    if (!transaction) {
      throw new BadRequestException('Provider transaction not found');
    }

    if (transaction.provider !== 'VIMOPAY') {
      throw new BadRequestException(
        'Provider transaction is not a VimoPay transaction',
      );
    }

    if (!['CW', 'AP', 'CD'].includes(transaction.operation)) {
      throw new BadRequestException(
        `Provider income is not supported for operation ${transaction.operation}`,
      );
    }

    if (transaction.status === 'REVERSED') {
      throw new BadRequestException(
        'Provider income cannot be reconciled for a reversed transaction',
      );
    }

    if (transaction.status !== 'SUCCESS') {
      throw new BadRequestException(
        `Provider income cannot be reconciled while transaction is ${transaction.status}`,
      );
    }

    if (transaction.settlementStatus !== 'SETTLED') {
      throw new BadRequestException(
        `Provider income cannot be reconciled until principal is SETTLED. Current status: ${transaction.settlementStatus}`,
      );
    }

    if (transaction.commissionStatus === 'REVERSED') {
      throw new BadRequestException('Commission has already been reversed');
    }

    if (
      !['WAITING_PROVIDER_INCOME', 'PENDING', 'SETTLED'].includes(
        transaction.commissionStatus,
      )
    ) {
      throw new BadRequestException(
        `Provider income cannot be reconciled from commission state ${transaction.commissionStatus}`,
      );
    }

    if (!transaction.sourceRole?.trim()) {
      throw new BadRequestException(
        'Provider transaction source role is unavailable',
      );
    }

    const transactionAmount = Number(transaction.amount);

    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      throw new BadRequestException('Provider transaction amount is invalid');
    }

    /*
     * =====================================================
     * 3. DETERMINE PROVIDER INCOME
     * =====================================================
     */

    const automaticIncome =
      this.vimopayIncomeService.resolveForSuccessfulTransaction(
        transactionAmount,
      );

    let providerIncomeAmount: number;

    let incomeSource:
      'DUMMY_VIMOPAY_2_PERCENT' | 'VIMOPAY_WALLET' | 'VIMOPAY_MS';

    let externalReference: string | undefined;

    /*
     * =====================================================
     * UAT
     * =====================================================
     */

    if (automaticIncome.available) {
      if (automaticIncome.amount === null || !automaticIncome.source) {
        throw new BadRequestException(
          'UAT provider income simulation is invalid',
        );
      }

      providerIncomeAmount = automaticIncome.amount;

      incomeSource = automaticIncome.source;

      /*
       * User supplied amount intentionally
       * ignored in UAT.
       */
    } else {
      /*
       * ===================================================
       * PRODUCTION
       * ===================================================
       */

      if (
        typeof input.providerIncomeAmount !== 'number' ||
        !Number.isFinite(input.providerIncomeAmount) ||
        input.providerIncomeAmount <= 0
      ) {
        throw new BadRequestException(
          'Production provider income amount must be greater than 0',
        );
      }

      if (
        input.incomeSource !== 'VIMOPAY_WALLET' &&
        input.incomeSource !== 'VIMOPAY_MS'
      ) {
        throw new BadRequestException(
          'Production incomeSource must be VIMOPAY_WALLET or VIMOPAY_MS',
        );
      }

      if (!input.externalReference?.trim()) {
        throw new BadRequestException(
          'Production VimoPay wallet/MS external reference is required',
        );
      }

      providerIncomeAmount = Number(input.providerIncomeAmount.toFixed(2));

      incomeSource = input.incomeSource;

      externalReference = input.externalReference.trim().slice(0, 150);
    }

    /*
     * =====================================================
     * 4. RECORD OBSERVED PROVIDER INCOME
     * =====================================================
     *
     * First processing:
     * WAITING_PROVIDER_INCOME / PENDING
     * → persist observed provider income.
     *
     * Already SETTLED retry:
     * PENDING par downgrade nahi karenge.
     *
     * settleProviderIncome() itself is
     * idempotent and will validate that
     * amount/source match existing commission.
     */

    if (transaction.commissionStatus !== 'SETTLED') {
      await this.providerTransactionService.updateCommissionState({
        referenceId: transaction.referenceId,

        status: 'PENDING',

        commissionAmount: providerIncomeAmount,

        providerIncomeSource: incomeSource,

        ...(externalReference
          ? {
              providerIncomeExternalReference: externalReference,
            }
          : {}),

        providerIncomeReconciledBy: input.reconciledBy,
      });
    }

    /*
     * =====================================================
     * 5. SETTLE THROUGH EXISTING COMMISSION ENGINE
     * =====================================================
     */

    const operation = transaction.operation as 'CW' | 'AP' | 'CD';

    const commission = await this.commissionService.settleProviderIncome({
      providerTransactionId: transaction.id,

      providerTransactionReference: transaction.referenceId,

      userId: transaction.userId,

      role: transaction.sourceRole,

      operation,

      transactionAmount,

      providerIncomeAmount,

      incomeSource,

      externalReference,

      reconciledBy: input.reconciledBy,
    });

    return {
      provider: 'VIMOPAY',

      transactionReferenceId: transaction.referenceId,

      operation,

      transactionAmount: transactionAmount.toFixed(2),

      providerIncome: {
        amount: providerIncomeAmount.toFixed(2),

        source: incomeSource,

        externalReference: externalReference ?? null,

        reconciledBy: input.reconciledBy,
      },

      commission,
    };
  }

  async cashDeposit(
    context: VimopayTransactionContext,
    dto: VimopayCashDepositRequestDto,
    idempotencyKey: string,
  ) {
    /*
     * =====================================================
     * 1. ACTIVE MERCHANT
     * =====================================================
     */

    const merchant = await this.accessService.getActiveMerchant(
      context.identityId,
    );

    /*
     * Financial transaction ke liye
     * authenticated business role mandatory.
     *
     * Ye role ProviderTransaction mein
     * persist hoga so delayed provider-income
     * reconciliation later same role use kare.
     */
    const sourceRole = this.requireFinancialSourceRole(context);

    const amount = Number(dto.amount);

    if (!Number.isFinite(amount) || amount < 100 || amount > 10000) {
      throw new BadRequestException(
        'Cash Deposit amount must be between 100 and 10000',
      );
    }

    /*
     * =====================================================
     * 2. IDEMPOTENCY
     * =====================================================
     */

    /*
     * Exact request fingerprint.
     */
    const requestHash = this.idempotencyService.createRequestHash({
      transactionType: 'CD',

      amount: amount.toFixed(2),

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,

      mobileNumber: dto.mobileNumber,
    });

    /*
     * Stable financial intent.
     *
     * Do NOT include:
     *
     * - PID data
     * - IP address
     * - biometric timestamp
     * - merchantRefId
     *
     * Same logical unresolved CD ko
     * another Idempotency-Key se
     * provider dobara hit nahi karna.
     */
    const intentHash = this.idempotencyService.createIntentHash({
      transactionType: 'CD',

      amount: amount.toFixed(2),

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,
    });

    const idempotency = await this.idempotencyService.begin({
      identityId: context.identityId,

      profileId: merchant.profileId,

      transactionType: AepsFinancialTransactionType.CASH_DEPOSIT,

      idempotencyKey,

      requestHash,

      intentHash,
    });

    /*
     * Same Idempotency-Key already
     * completed/pending.
     *
     * Provider dobara call nahi hoga.
     */
    if (!idempotency.shouldExecute) {
      return idempotency.response;
    }

    /*
     * =====================================================
     * 3. ATOMIC PTXN + FULL AEPS PRE-DEBIT
     * =====================================================
     *
     * Example:
     *
     * CD ₹500
     *
     * AEPS -₹500 immediately reserved.
     *
     * Provider income/commission
     * yahan calculate nahi hogi.
     */

    let prepared: any;

    try {
      prepared = await this.walletService.prepareCashDeposit({
        userId: context.identityId,

        providerTransactionIdempotencyKey: idempotencyKey,

        merchantProfileId: merchant.profileId,

        providerMerchantId: merchant.merchantId,

        /*
         * IMPORTANT:
         * authenticated source role
         */
        sourceRole,

        /*
         * FULL transaction amount.
         */
        amount,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),
      });
    } catch (error) {
      /*
       * Provider call abhi start nahi hui.
       *
       * Idempotency reservation safely
       * remove ho sakti hai.
       */
      await this.idempotencyService.abandonBeforeProvider(
        idempotency.recordId,

        idempotency.lockToken,
      );

      throw error;
    }

    const providerTransaction = prepared.providerTransaction;

    const reservationTransaction = prepared.walletTransaction;

    const providerTransactionId: string = providerTransaction.id;

    const providerTransactionReference: string =
      providerTransaction.referenceId;

    const reservationTransactionReference: string =
      reservationTransaction.referenceId;

    /*
     * Defensive validation.
     */

    if (
      !providerTransactionId ||
      !providerTransactionReference ||
      !reservationTransactionReference
    ) {
      await this.idempotencyService.markUnknown(
        idempotency.recordId,

        idempotency.lockToken,
      );

      throw new InternalServerErrorException(
        'Cash Deposit reservation references are missing',
      );
    }

    /*
     * =====================================================
     * 4. PROVIDER MERCHANT REFERENCE
     * =====================================================
     */

    const merchantRefId = this.generateMerchantRefId('CD');

    /*
     * =====================================================
     * 5. MARK PROVIDER TRANSACTION PROCESSING
     * =====================================================
     */

    try {
      await this.providerTransactionService.markProcessing(
        providerTransactionReference,

        merchantRefId,
      );
    } catch (error) {
      /*
       * VimoPay definitely NOT called.
       *
       * Therefore:
       *
       * - PTXN FAILED
       * - full AEPS reservation refund
       * - provider must NOT be retried until
       *   local state is safely resolved
       */

      try {
        await this.providerTransactionService.finalize({
          referenceId: providerTransactionReference,

          status: 'FAILED',

          providerMerchantRefId: merchantRefId,

          providerStatusCode: 'LOCAL_PRE_PROVIDER_FAILURE',

          providerStatusMessage: 'Cash Deposit provider call did not start',

          metadata: {
            category: 'FINANCIAL',

            settlementMode: 'PRE_DEBIT',

            incomeModel: 'PROVIDER_INCOME',

            principalAmount: amount.toFixed(2),
          },
        });
      } catch (finalizeError) {
        this.logger.error(
          'Unable to mark pre-provider CD transaction FAILED',

          finalizeError instanceof Error ? finalizeError.stack : undefined,
        );

        try {
          await this.providerTransactionService.markFinancialRecoveryRequired(
            providerTransactionReference,

            error instanceof Error
              ? `CD compensation pending: ${error.message}`
              : 'CD compensation pending',
          );
        } catch (trackingError) {
          this.logger.error(
            'Unable to mark CD compensation recovery required',

            trackingError instanceof Error ? trackingError.stack : undefined,
          );
        }
      }

      /*
       * Refund full reserved principal.
       */

      let compensated = false;

      try {
        await this.walletService.compensateCashDeposit({
          userId: context.identityId,

          providerTransactionReference,

          amount,
        });

        compensated = true;
      } catch (compensationError) {
        this.logger.error(
          'Unable to compensate CD after provider call preparation failure',

          compensationError instanceof Error
            ? compensationError.stack
            : undefined,
        );
      }

      /*
       * Provider definitely wasn't called.
       *
       * If local compensation succeeded,
       * request can safely be released.
       */

      if (compensated) {
        await this.idempotencyService.abandonBeforeProvider(
          idempotency.recordId,

          idempotency.lockToken,
        );
      } else {
        /*
         * Local financial state unresolved.
         *
         * Do NOT permit automatic retry.
         */
        await this.idempotencyService.markUnknown(
          idempotency.recordId,

          idempotency.lockToken,

          merchantRefId,
        );
      }

      throw error;
    }

    /*
     * =====================================================
     * 6. VIMOPAY PROVIDER CALL
     * =====================================================
     *
     * Provider receives FULL transaction amount.
     */

    let result: Awaited<ReturnType<VimopayService['cashDeposit']>>;

    try {
      result = await this.vimopayService.cashDeposit({
        merchantRefId,

        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        /*
         * FULL amount.
         */
        amount: amount.toFixed(2),

        bankIIN: dto.bankIIN,

        ipAddress: context.ipAddress,

        lat: dto.lat,

        long: dto.long,

        deviceType: dto.deviceType,

        udf1: dto.udf1 ?? '',

        udf2: dto.udf2 ?? '',

        udf3: dto.udf3 ?? '',

        pidData: dto.pidData,
      });
    } catch (error) {
      /*
       * =====================================================
       * PROVIDER CALL STARTED BUT RESULT UNKNOWN
       * =====================================================
       *
       * CRITICAL:
       *
       * DO NOT:
       *
       * - refund AEPS
       * - retry VimoPay
       * - assume failure
       *
       * Reservation remains held.
       */

      await this.idempotencyService.markUnknown(
        idempotency.recordId,

        idempotency.lockToken,

        /*
         * Preserve generated merchant ref
         * for reconciliation.
         */
        merchantRefId,
      );

      try {
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransactionReference,

          providerMerchantRefId: merchantRefId,

          reason:
            error instanceof Error
              ? error.message
              : 'VimoPay Cash Deposit request failed',
        });
      } catch (trackingError) {
        this.logger.error(
          'Unable to mark CD provider transaction UNKNOWN',

          trackingError instanceof Error ? trackingError.stack : undefined,
        );
      }

      throw error;
    }

    /*
     * =====================================================
     * 7. FINALIZE PROVIDER TRANSACTION
     * =====================================================
     */

    const finalStatus = this.mapProviderTransactionStatus(result.status);

    try {
      if (finalStatus) {
        await this.providerTransactionService.finalize({
          referenceId: providerTransactionReference,

          status: finalStatus,

          providerMerchantRefId: merchantRefId,

          providerTxnRefId: result.txnRefId,

          rrn: result.rrn,

          npciCode: result.npciCode,

          npciMessage: result.npciMessage,

          providerStatusCode: result.status,

          providerStatusMessage: result.statusDescription,

          metadata: {
            category: 'FINANCIAL',

            settlementMode: 'PRE_DEBIT',

            incomeModel: 'PROVIDER_INCOME',

            principalAmount: amount.toFixed(2),

            ...this.getSafeReceiptMetadata(result),
          },
        });
      } else {
        /*
         * Unexpected provider response.
         */
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransactionReference,

          providerMerchantRefId: merchantRefId,

          reason: `Unexpected VimoPay transaction status: ${result.status}`,
        });
      }
    } catch (error) {
      /*
       * Provider response already received.
       *
       * Never undo wallet blindly.
       * Never call provider again.
       */
      this.logger.error(
        'Unable to finalize canonical Cash Deposit transaction',

        error instanceof Error ? error.stack : undefined,
      );
    }

    /*
     * =====================================================
     * 8. PRINCIPAL SETTLEMENT
     * =====================================================
     */

    let settlementStatus: 'RESERVED' | 'SETTLED' | 'COMPENSATED' = 'RESERVED';

    let compensationTransactionReference: string | null = null;

    /*
     * =====================================================
     * SUCCESS
     * =====================================================
     *
     * Original AEPS debit already happened.
     *
     * Just confirm reservation.
     */

    if (result.status === '000') {
      try {
        await this.walletService.confirmCashDeposit({
          userId: context.identityId,

          providerTransactionReference,
        });

        settlementStatus = 'SETTLED';
      } catch (error) {
        settlementStatus = 'RESERVED';

        this.logger.error(
          'CD provider success but AEPS reservation confirmation is pending',

          error instanceof Error ? error.stack : undefined,
        );

        try {
          await this.providerTransactionService.markFinancialRecoveryRequired(
            providerTransactionReference,

            error instanceof Error
              ? `CD reservation confirmation pending: ${error.message}`
              : 'CD reservation confirmation pending',
          );
        } catch (trackingError) {
          this.logger.error(
            'Unable to mark CD financial recovery required',

            trackingError instanceof Error ? trackingError.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * DEFINITIVE FAILURE
     * =====================================================
     *
     * VimoPay:
     *
     * 001 = FAILED
     * 003 = VALIDATION FAILED
     *
     * Full AEPS principal refund.
     */

    if (result.status === '001' || result.status === '003') {
      try {
        const compensation = await this.walletService.compensateCashDeposit({
          userId: context.identityId,

          providerTransactionReference,

          amount,
        });

        settlementStatus = 'COMPENSATED';

        compensationTransactionReference = compensation.referenceId;
      } catch (error) {
        /*
         * Provider definitely failed
         * but local refund unresolved.
         */

        settlementStatus = 'RESERVED';

        this.logger.error(
          'CD failed but full AEPS compensation is pending',

          error instanceof Error ? error.stack : undefined,
        );

        /*
         * Ensure recovery queue catches it.
         */
        try {
          await this.providerTransactionService.markFinancialRecoveryRequired(
            providerTransactionReference,

            error instanceof Error
              ? `CD failed but compensation pending: ${error.message}`
              : 'CD failed but compensation pending',
          );
        } catch (trackingError) {
          this.logger.error(
            'Unable to mark failed CD compensation recovery required',

            trackingError instanceof Error ? trackingError.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * 9. PROVIDER INCOME / COMMISSION
     * =====================================================
     */

    let providerIncomeAmount: number | null = null;

    let incomeSource: string | null = null;

    let commissionResult: AepsCommissionSettlementResult = {
      status: result.status === '000' ? 'PENDING' : 'NOT_REQUIRED',

      amount: null,

      grossAmount: amount.toFixed(2),

      /*
       * Provider income does NOT
       * reduce principal.
       */
      netAmount: amount.toFixed(2),

      commissionReference: null,

      walletTransactionReference: null,

      distributions: [],

      reason:
        result.status === '000'
          ? 'WAITING_FOR_PRINCIPAL_SETTLEMENT'
          : 'PROVIDER_TRANSACTION_NOT_SUCCESSFUL',
    };

    /*
     * Provider income only after:
     *
     * provider SUCCESS
     * +
     * AEPS reservation confirmed.
     */

    if (result.status === '000' && settlementStatus === 'SETTLED') {
      try {
        const income =
          this.vimopayIncomeService.resolveForSuccessfulTransaction(amount);

        /*
         * =================================================
         * PRODUCTION
         * =================================================
         *
         * Actual provider wallet/MS income
         * will be reconciled later.
         */

        if (!income.available) {
          providerIncomeAmount = null;

          incomeSource = null;

          await this.providerTransactionService.updateCommissionState({
            referenceId: providerTransactionReference,

            status: 'WAITING_PROVIDER_INCOME',

            failureReason:
              income.reason ?? 'Waiting for VimoPay provider income',
          });

          commissionResult = {
            status: 'PENDING',

            amount: null,

            grossAmount: amount.toFixed(2),

            netAmount: amount.toFixed(2),

            commissionReference: null,

            walletTransactionReference: null,

            distributions: [],

            reason: 'WAITING_FOR_PROVIDER_INCOME',
          };
        } else {
          /*
           * =================================================
           * UAT / INCOME AVAILABLE
           * =================================================
           */

          if (
            income.amount === null ||
            !Number.isFinite(income.amount) ||
            income.amount < 0
          ) {
            throw new Error('Resolved VimoPay income amount is invalid');
          }

          if (!income.source) {
            throw new Error('Resolved VimoPay income source is missing');
          }

          providerIncomeAmount = income.amount;

          incomeSource = income.source;

          /*
           * Existing provider-funded
           * commission distribution engine.
           */

          commissionResult = await this.commissionService.settleProviderIncome({
            providerTransactionId,

            providerTransactionReference,

            userId: context.identityId,

            /*
             * IMPORTANT:
             * frozen authenticated role.
             */
            role: sourceRole,

            operation: 'CD',

            /*
             * FULL principal.
             */
            transactionAmount: amount,

            /*
             * Separate provider income.
             */
            providerIncomeAmount: income.amount,

            incomeSource: income.source,
          });
        }
      } catch (error) {
        /*
         * Provider + principal state
         * already authoritative.
         *
         * Income failure principal ko
         * rollback nahi karegi.
         */

        commissionResult = {
          status: 'PENDING',

          amount:
            providerIncomeAmount !== null
              ? providerIncomeAmount.toFixed(2)
              : null,

          grossAmount: amount.toFixed(2),

          netAmount: amount.toFixed(2),

          commissionReference: null,

          walletTransactionReference: null,

          distributions: [],

          reason: 'PROVIDER_INCOME_SETTLEMENT_PENDING',
        };

        this.logger.error(
          `CD provider income settlement pending for ${providerTransactionReference}`,

          error instanceof Error ? error.stack : undefined,
        );

        try {
          await this.providerTransactionService.updateCommissionState({
            referenceId: providerTransactionReference,

            status: 'PENDING',

            ...(providerIncomeAmount !== null
              ? {
                  commissionAmount: providerIncomeAmount,
                }
              : {}),

            failureReason:
              error instanceof Error
                ? error.message
                : 'Provider income settlement failed',
          });
        } catch {
          /*
           * Preserve provider and
           * principal authority.
           */
        }
      }
    }

    /*
     * =====================================================
     * 10. SUCCESS BUT PRINCIPAL NOT CONFIRMED
     * =====================================================
     */

    if (result.status === '000' && settlementStatus !== 'SETTLED') {
      commissionResult = {
        status: 'PENDING',

        amount: null,

        grossAmount: amount.toFixed(2),

        netAmount: amount.toFixed(2),

        commissionReference: null,

        walletTransactionReference: null,

        distributions: [],

        reason: 'WAITING_FOR_PRINCIPAL_SETTLEMENT',
      };

      try {
        await this.providerTransactionService.updateCommissionState({
          referenceId: providerTransactionReference,

          status: 'PENDING',

          failureReason: 'Waiting for AEPS Cash Deposit principal settlement',
        });
      } catch {
        /*
         * Preserve provider response.
         */
      }
    }

    /*
     * =====================================================
     * 11. DEFINITIVE PROVIDER FAILURE
     * =====================================================
     *
     * No provider income exists.
     */

    if (result.status === '001' || result.status === '003') {
      commissionResult = {
        status: 'NOT_REQUIRED',

        amount: '0.00',

        grossAmount: amount.toFixed(2),

        netAmount: amount.toFixed(2),

        commissionReference: null,

        walletTransactionReference: null,

        distributions: [],

        reason: 'PROVIDER_TRANSACTION_FAILED',
      };

      try {
        await this.providerTransactionService.updateCommissionState({
          referenceId: providerTransactionReference,

          status: 'NOT_REQUIRED',
        });
      } catch {
        /*
         * Preserve provider result.
         */
      }
    }

    /*
     * =====================================================
     * 12. PROVIDER PENDING / UNKNOWN
     * =====================================================
     *
     * 002:
     * provider pending.
     *
     * unexpected status:
     * canonical PTXN marked UNKNOWN.
     *
     * In both:
     *
     * - reservation remains RESERVED
     * - no provider income
     * - no compensation yet
     */

    if (
      result.status !== '000' &&
      result.status !== '001' &&
      result.status !== '003'
    ) {
      commissionResult = {
        status: 'PENDING',

        amount: null,

        grossAmount: amount.toFixed(2),

        netAmount: amount.toFixed(2),

        commissionReference: null,

        walletTransactionReference: null,

        distributions: [],

        reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
      };

      try {
        await this.providerTransactionService.updateCommissionState({
          referenceId: providerTransactionReference,

          status: 'PENDING',

          failureReason: 'Waiting for Cash Deposit provider resolution',
        });
      } catch {
        /*
         * Preserve provider state.
         */
      }
    }

    /*
     * =====================================================
     * 13. RESPONSE
     * =====================================================
     */

    const response = {
      provider: 'VIMOPAY',

      transactionType: 'CD',

      transactionReferenceId: providerTransactionReference,

      profileId: merchant.profileId,

      merchantRefId,

      providerMerchantId: merchant.merchantId,

      /*
       * FULL transaction amount.
       */
      amount: amount.toFixed(2),

      accounting: {
        /*
         * Full provider amount.
         */
        transactionAmount: amount.toFixed(2),

        /*
         * Full AEPS debit.
         */
        principalDebitAmount: amount.toFixed(2),

        /*
         * Separate provider income.
         */
        providerIncomeAmount:
          providerIncomeAmount !== null
            ? providerIncomeAmount.toFixed(2)
            : null,

        incomeSource,
      },

      result,

      settlement: {
        status: settlementStatus,

        walletType: 'AEPS',

        /*
         * Original principal debit.
         */
        amount: amount.toFixed(2),

        transactionReference: reservationTransactionReference,

        compensationTransactionReference,
      },

      commission: commissionResult,
    };

    /*
     * =====================================================
     * 14. IDEMPOTENCY COMPLETE
     * =====================================================
     */

    try {
      await this.idempotencyService.complete({
        recordId: idempotency.recordId,

        lockToken: idempotency.lockToken,

        response,

        providerStatusCode: result.status,

        providerMerchantRefId: merchantRefId,

        providerTxnRefId: result.txnRefId,
      });
    } catch (error) {
      this.logger.error(
        'Cash Deposit idempotency finalization failed',

        error instanceof Error ? error.stack : undefined,
      );
    }

    return response;
  }

  private requireFinancialSourceRole(
    context: VimopayTransactionContext,
  ): string {
    const role = context.role?.trim();

    if (!role) {
      throw new InternalServerErrorException(
        'Authenticated user role is required for financial AEPS transaction',
      );
    }

    return role;
  }

  async syncIdempotencyAfterReconciliation(input: {
    identityId: string;

    operation: 'CW' | 'AP' | 'CD';

    resolution: 'SUCCESS' | 'FAILED';

    idempotencyKey?: string;

    providerMerchantRefId?: string;

    providerTxnRefId?: string;

    response: unknown;
  }) {
    /*
     * =====================================================
     * MAP OPERATION
     * =====================================================
     */

    let transactionType: AepsFinancialTransactionType;

    switch (input.operation) {
      case 'CW':
        transactionType = AepsFinancialTransactionType.CASH_WITHDRAWAL;
        break;

      case 'AP':
        transactionType = AepsFinancialTransactionType.AADHAAR_PAY;
        break;

      case 'CD':
        transactionType = AepsFinancialTransactionType.CASH_DEPOSIT;
        break;

      default:
        throw new BadRequestException(
          'Unsupported VimoPay financial operation for idempotency reconciliation',
        );
    }

    /*
     * =====================================================
     * SYNC
     * =====================================================
     */

    return this.idempotencyService.resolveAfterReconciliation({
      identityId: input.identityId,

      transactionType,

      resolution: input.resolution,

      response: input.response,

      idempotencyKey: input.idempotencyKey,

      providerMerchantRefId: input.providerMerchantRefId,

      providerTxnRefId: input.providerTxnRefId,
    });
  }

  private getSafeReceiptMetadata(result: any) {
    return {
      ...(typeof result?.txnDateTime === 'string'
        ? {
            providerTxnDateTime: result.txnDateTime,
          }
        : {}),

      ...(typeof result?.availableBalance === 'string'
        ? {
            availableBalance: result.availableBalance,
          }
        : {}),
    };
  }
}
