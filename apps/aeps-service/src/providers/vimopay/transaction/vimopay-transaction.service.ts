import { BadRequestException, Injectable, Logger } from '@nestjs/common';

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

export interface VimopayTransactionContext {
  identityId: string;
  role?: string;
  ipAddress: string;
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
     * Customer/provider-facing GROSS amount.
     */
    const grossAmount = Number(dto.amount);

    if (
      !Number.isFinite(grossAmount) ||
      grossAmount < 100 ||
      grossAmount > 10000
    ) {
      throw new BadRequestException(
        'Cash Withdrawal amount must be between 100 and 10000',
      );
    }

    /*
     * <=5000:
     * CWTFA authorization nahi.
     */
    if (grossAmount <= 5000 && dto.authRequestId) {
      throw new BadRequestException(
        'authRequestId must not be provided for Cash Withdrawal up to 5000',
      );
    }

    /*
     * >5000:
     * CWTFA authorization mandatory.
     *
     * Authorization GROSS amount par hai.
     */
    if (grossAmount > 5000 && !dto.authRequestId) {
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

      /*
       * Financial intent GROSS amount.
       */
      amount: grossAmount.toFixed(2),

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
    this.logger.log(`[CW] BEFORE PROVIDER TXN CREATE key=${idempotency.shouldExecute}`);

    /*
     * Completed/PENDING cached request.
     */
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

    /*
     * Commission snapshot.
     */
    let commissionPreparation: Awaited<
      ReturnType<AepsCommissionService['prepare']>
    > | null = null;

    /*
     * Defaults:
     *
     * no commission → full amount principal.
     */
    let commissionAmount = 0;

    let netPrincipalAmount = grossAmount;

    let result: Awaited<ReturnType<VimopayService['cashWithdrawal']>>;

    /*
     * =====================================================
     * 4. PRE-PROVIDER
     * =====================================================
     */

    try {
      /*
       * ===================================================
       * >5000 CWTFA AUTHORIZATION
       * ===================================================
       */

      if (grossAmount > 5000) {
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

        /*
         * Authorization amount =
         * GROSS provider transaction.
         */
        if (Number(authorization.amount) !== grossAmount) {
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
         * Atomic authorization claim.
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
       * 5. CREATE CANONICAL PROVIDER TRANSACTION
       * ===================================================
       *
       * PTXN amount always GROSS.
       */

      const providerTransaction = await this.providerTransactionService.create({
        userId: context.identityId,

        serviceType: 'AEPS',

        provider: 'VIMOPAY',

        operation: 'CW',

        amount: grossAmount,

        settlementRequired: true,

        idempotencyKey,

        merchantProfileId: merchant.profileId,

        providerMerchantId: merchant.merchantId,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),

        metadata: {
          category: 'FINANCIAL',

          accountingModel: 'GROSS_MINUS_COMMISSION',

          transactionOtpRequired: grossAmount > 5000,

          ...(dto.authRequestId
            ? {
                authRequestId: dto.authRequestId,
              }
            : {}),
        },
      });

      /*
       * Local non-null values.
       *
       * Inke through TypeScript ko clear hai
       * ki yahan null possible nahi hai.
       */
      const currentProviderTransactionId: string = providerTransaction.id;

      const currentProviderTransactionReferenceId: string =
        providerTransaction.referenceId;
      this.logger.log(
        `[CW] PROVIDER TXN CREATED ref=${providerTransaction.referenceId}`,
      );
      /*
       * Outer state mein bhi preserve,
       * because catch/finalization sections
       * later in method use karte hain.
       */
      providerTransactionId = currentProviderTransactionId;

      providerTransactionReferenceId = currentProviderTransactionReferenceId;

      /*
       * ===================================================
       * 6. PREPARE + SNAPSHOT COMMISSION
       * ===================================================
       */

      commissionPreparation = await this.commissionService.prepare({
        providerTransactionId: currentProviderTransactionId,

        providerTransactionReference: currentProviderTransactionReferenceId,

        userId: context.identityId,

        role: context.role,

        operation: 'CW',

        amount: grossAmount,
      });

      commissionAmount = Number(commissionPreparation.commissionAmount);

      netPrincipalAmount = Number(commissionPreparation.netAmount);

      /*
       * ===================================================
       * ACCOUNTING SAFETY
       * ===================================================
       */

      if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
        throw new Error('Invalid prepared commission amount');
      }

      if (!Number.isFinite(netPrincipalAmount) || netPrincipalAmount <= 0) {
        throw new Error('Invalid prepared net principal amount');
      }

      const grossPaise = Math.round(grossAmount * 100);

      const commissionPaise = Math.round(commissionAmount * 100);

      const netPaise = Math.round(netPrincipalAmount * 100);

      if (netPaise + commissionPaise !== grossPaise) {
        throw new Error('Cash Withdrawal commission accounting mismatch');
      }

      /*
       * ===================================================
       * 7. PROVIDER MERCHANT REF
       * ===================================================
       */

      const currentMerchantRefId: string = this.generateMerchantRefId('CW');

      /*
       * Outer variable later response/catch
       * sections ke liye.
       */
      merchantRefId = currentMerchantRefId;

      /*
       * INITIATED → PROCESSING
       */
      await this.providerTransactionService.markProcessing(
        currentProviderTransactionReferenceId,
        currentMerchantRefId,
      );

      /*
       * ===================================================
       * 8. PROVIDER DTO
       * ===================================================
       *
       * IMPORTANT:
       *
       * VimoPay gets GROSS ₹150.
       *
       * Merchant/customer payout will be
       * NET ₹140 according to current business model.
       */

      const providerDto: VimopayCashWithdrawalDto = {
        merchantRefId,

        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        /*
         * VimoPay = GROSS.
         */
        amount: dto.amount,

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
       * 9. PROVIDER CALL
       * ===================================================
       */

      providerCallStarted = true;

      result = await this.vimopayService.cashWithdrawal(providerDto);
    } catch (error) {
      /*
       * ===================================================
       * PROVIDER CALL DID NOT START
       * ===================================================
       */

      if (!providerCallStarted) {
        /*
         * High-value auth release.
         */
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

        /*
         * Provider wasn't called.
         *
         * AEPS execution idempotency
         * can safely be abandoned.
         *
         * ProviderTransaction/Commission
         * snapshots remain idempotently
         * reusable on retry.
         */
        await this.idempotencyService.abandonBeforeProvider(
          idempotency.recordId,

          idempotency.lockToken,
        );

        throw error;
      }

      /*
       * ===================================================
       * PROVIDER CALL STARTED — RESULT UNKNOWN
       * ===================================================
       */

      await this.idempotencyService.markUnknown(
        idempotency.recordId,

        idempotency.lockToken,
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

      /*
       * Do NOT cancel commission snapshot.
       *
       * Provider transaction may have
       * actually succeeded.
       */

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
           * Preserve original error.
           */
        }
      }

      throw error;
    }

    /*
     * =====================================================
     * Provider definitive response available.
     * =====================================================
     */

    /*
     * =====================================================
     * 10. FINALIZE >5000 AUTHORIZATION
     * =====================================================
     */

    if (grossAmount > 5000 && claimedAuthorizationId) {
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
     * 11. FINALIZE PROVIDER TRANSACTION
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

            accountingModel: 'GROSS_MINUS_COMMISSION',

            grossAmount: grossAmount.toFixed(2),

            commissionAmount: commissionAmount.toFixed(2),

            netPrincipalAmount: netPrincipalAmount.toFixed(2),

            transactionOtpRequired: grossAmount > 5000,
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
     * 12. PRINCIPAL SETTLEMENT
     * =====================================================
     */

    let settlementStatus: 'NOT_REQUIRED' | 'PENDING' | 'SETTLED' =
      result.status === '001' || result.status === '003'
        ? 'NOT_REQUIRED'
        : 'PENDING';

    let settlementTransactionReference: string | null = null;

    /*
     * =====================================================
     * COMMISSION RESPONSE DEFAULT
     * =====================================================
     */

    let commissionResult: Awaited<ReturnType<AepsCommissionService['settle']>> =
      {
        status:
          commissionPreparation?.status === 'PREPARED'
            ? 'PENDING'
            : 'NOT_REQUIRED',

        /*
         * Commission actually paid nahi hui
         * yet, but pool amount known hai.
         */
        amount: commissionPreparation?.commissionAmount ?? '0.00',

        grossAmount: grossAmount.toFixed(2),

        netAmount: netPrincipalAmount.toFixed(2),

        commissionReference: commissionPreparation?.commissionReference ?? null,

        walletTransactionReference: null,

        distributions: [],

        ...(commissionPreparation?.reason
          ? {
              reason: commissionPreparation.reason,
            }
          : {}),
      };

    /*
     * =====================================================
     * PROVIDER SUCCESS
     * =====================================================
     */

    if (result.status === '000') {
      /*
       * CW principal AEPS wallet receives NET.
       */
      try {
        const settlement = await this.walletService.settlePrincipal({
          userId: context.identityId,

          providerTransactionReference: providerTransactionReferenceId!,

          operation: 'CW',

          /*
           * Canonical provider amount.
           */
          grossAmount,

          /*
           * AEPS actual wallet movement.
           */
          netAmount: netPrincipalAmount,
        });

        settlementStatus = 'SETTLED';

        settlementTransactionReference = settlement.referenceId;
      } catch (error) {
        settlementStatus = 'PENDING';

        this.logger.error(
          'CW provider success but AEPS net principal settlement is pending',

          error instanceof Error ? error.stack : undefined,
        );
      }

      /*
       * ===================================================
       * EXECUTE COMMISSION DISTRIBUTIONS
       * ===================================================
       *
       * Only after principal settles.
       */

      if (settlementStatus === 'SETTLED') {
        /*
         * Commission was actually configured
         * when transaction started.
         */
        if (
          commissionPreparation?.status === 'PREPARED' &&
          providerTransactionId
        ) {
          try {
            /*
             * settle() uses same commission
             * idempotency key.
             *
             * Therefore it gets the PREVIOUSLY
             * snapshotted allocations.
             *
             * CRUD changes after prepare()
             * do not affect this transaction.
             */
            commissionResult = await this.commissionService.settle({
              providerTransactionId,

              providerTransactionReference: providerTransactionReferenceId!,

              userId: context.identityId,

              role: context.role,

              operation: 'CW',

              /*
               * GROSS.
               */
              amount: grossAmount,
            });
          } catch (error) {
            commissionResult = {
              status: 'PENDING',

              amount: commissionAmount.toFixed(2),

              grossAmount: grossAmount.toFixed(2),

              netAmount: netPrincipalAmount.toFixed(2),

              commissionReference: commissionPreparation.commissionReference,

              walletTransactionReference: null,

              distributions: [],

              reason: 'COMMISSION_SETTLEMENT_PENDING',
            };

            this.logger.error(
              'CW commission distribution settlement failed',

              error instanceof Error ? error.stack : undefined,
            );

            try {
              await this.providerTransactionService.updateCommissionState({
                referenceId: providerTransactionReferenceId!,

                status: 'PENDING',

                commissionReferenceId:
                  commissionPreparation.commissionReference ?? undefined,

                commissionAmount,

                failureReason:
                  error instanceof Error
                    ? error.message
                    : 'Commission settlement failed',
              });
            } catch {
              /*
               * Preserve provider result.
               */
            }
          }
        } else {
          /*
           * IMPORTANT:
           *
           * prepare() said NO commission.
           *
           * Do NOT call settle() again.
           *
           * Otherwise a CRUD rule created
           * between provider call and settlement
           * could incorrectly affect this
           * already-started transaction.
           */

          commissionResult = {
            status: 'NOT_REQUIRED',

            amount: '0.00',

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: null,

            walletTransactionReference: null,

            distributions: [],

            reason: commissionPreparation?.reason ?? 'NO_COMMISSION',
          };
        }
      } else {
        /*
         * Provider SUCCESS,
         * principal still pending.
         *
         * Commission distributions MUST
         * not execute yet.
         */

        if (commissionPreparation?.status === 'PREPARED') {
          commissionResult = {
            status: 'PENDING',

            amount: commissionAmount.toFixed(2),

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: commissionPreparation.commissionReference,

            walletTransactionReference: null,

            distributions: [],

            reason: 'WAITING_FOR_PRINCIPAL_SETTLEMENT',
          };

          try {
            await this.providerTransactionService.updateCommissionState({
              referenceId: providerTransactionReferenceId!,

              status: 'PENDING',

              commissionReferenceId:
                commissionPreparation.commissionReference ?? undefined,

              commissionAmount,

              failureReason: 'Waiting for AEPS net principal settlement',
            });
          } catch {
            /*
             * Continue response.
             */
          }
        }
      }
    }

    /*
     * =====================================================
     * PROVIDER DEFINITIVE FAILURE
     * =====================================================
     */

    if (result.status === '001' || result.status === '003') {
      /*
       * No principal credit.
       *
       * Prepared commission snapshot
       * must be cancelled.
       */

      if (commissionPreparation?.status === 'PREPARED') {
        try {
          await this.commissionService.cancel({
            providerTransactionReference: providerTransactionReferenceId!,

            commissionReference: commissionPreparation.commissionReference,

            reason: `Cash Withdrawal provider failed: ${result.statusDescription}`,
          });

          commissionResult = {
            status: 'NOT_REQUIRED',

            amount: '0.00',

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: commissionPreparation.commissionReference,

            walletTransactionReference: null,

            distributions: [],

            reason: 'PROVIDER_TRANSACTION_FAILED_COMMISSION_CANCELLED',
          };
        } catch (error) {
          /*
           * Commission cancellation requires
           * internal retry/reconciliation.
           */

          commissionResult = {
            status: 'PENDING',

            amount: commissionAmount.toFixed(2),

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: commissionPreparation.commissionReference,

            walletTransactionReference: null,

            distributions: [],

            reason: 'COMMISSION_CANCELLATION_PENDING',
          };

          this.logger.error(
            'Unable to cancel failed CW commission snapshot',

            error instanceof Error ? error.stack : undefined,
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
      /*
       * No wallet settlement.
       *
       * No commission distribution.
       *
       * Snapshot remains frozen for future
       * provider reconciliation.
       */

      if (commissionPreparation?.status === 'PREPARED') {
        commissionResult = {
          status: 'PENDING',

          amount: commissionAmount.toFixed(2),

          grossAmount: grossAmount.toFixed(2),

          netAmount: netPrincipalAmount.toFixed(2),

          commissionReference: commissionPreparation.commissionReference,

          walletTransactionReference: null,

          distributions: [],

          reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
        };
      }
    }

    /*
     * Unexpected provider status was
     * canonical UNKNOWN.
     */
    if (
      !['000', '001', '002', '003'].includes(result.status) &&
      commissionPreparation?.status === 'PREPARED'
    ) {
      commissionResult = {
        status: 'PENDING',

        amount: commissionAmount.toFixed(2),

        grossAmount: grossAmount.toFixed(2),

        netAmount: netPrincipalAmount.toFixed(2),

        commissionReference: commissionPreparation.commissionReference,

        walletTransactionReference: null,

        distributions: [],

        reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
      };
    }

    /*
     * =====================================================
     * 13. FINAL RESPONSE
     * =====================================================
     */

    const response = {
      provider: 'VIMOPAY',

      transactionType: 'CW',

      transactionReferenceId: providerTransactionReferenceId!,

      profileId: merchant.profileId,

      merchantRefId: merchantRefId!,

      providerMerchantId: merchant.merchantId,

      /*
       * Existing field remains GROSS.
       */
      amount: dto.amount,

      /*
       * Explicit accounting information.
       */
      accounting: {
        grossAmount: grossAmount.toFixed(2),

        commissionAmount: commissionAmount.toFixed(2),

        /*
         * Under current business model,
         * merchant gives this amount
         * to customer.
         */
        customerPayoutAmount: netPrincipalAmount.toFixed(2),

        netPrincipalAmount: netPrincipalAmount.toFixed(2),
      },

      result,

      /*
       * AEPS net principal wallet credit.
       */
      settlement: {
        status: settlementStatus,

        walletType: result.status === '000' ? 'AEPS' : null,

        /*
         * Amount actually posted to
         * merchant AEPS wallet.
         */
        amount: result.status === '000' ? netPrincipalAmount.toFixed(2) : null,

        transactionReference: settlementTransactionReference,
      },

      /*
       * One commission can contain
       * MULTIPLE distribution results.
       */
      commission: commissionResult,
    };

    /*
     * =====================================================
     * 14. COMPLETE IDEMPOTENCY
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
     * GROSS transaction amount.
     *
     * Example:
     * Customer transaction = ₹150
     */
    const grossAmount = Number(dto.amount);

    if (
      !Number.isFinite(grossAmount) ||
      grossAmount < 100 ||
      grossAmount > 10000
    ) {
      throw new BadRequestException(
        'Aadhaar Pay amount must be between 100 and 10000',
      );
    }

    /*
     * <=5000:
     * APTFA authorization nahi.
     */
    if (grossAmount <= 5000 && dto.authRequestId) {
      throw new BadRequestException(
        'authRequestId must not be provided for Aadhaar Pay up to 5000',
      );
    }

    /*
     * >5000:
     * APTFA authorization mandatory.
     *
     * Authorization GROSS amount par.
     */
    if (grossAmount > 5000 && !dto.authRequestId) {
      throw new BadRequestException({
        message: 'Aadhaar Pay above 5000 requires transaction authorization',

        code: 'VIMOPAY_AP_TRANSACTION_OTP_REQUIRED',
      });
    }

    /*
     * =====================================================
     * 2. IDEMPOTENCY
     * =====================================================
     */

    const requestHash = this.idempotencyService.createRequestHash({
      transactionType: 'AP',

      /*
       * Financial intent = GROSS.
       */
      amount: grossAmount.toFixed(2),

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,

      mobileNumber: dto.mobileNumber,
    });

    const idempotency = await this.idempotencyService.begin({
      identityId: context.identityId,

      profileId: merchant.profileId,

      transactionType: AepsFinancialTransactionType.AADHAAR_PAY,

      idempotencyKey,

      requestHash,
    });

    /*
     * Already processed/cached.
     */
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

    /*
     * Commission snapshot created
     * BEFORE provider call.
     */
    let commissionPreparation: Awaited<
      ReturnType<AepsCommissionService['prepare']>
    > | null = null;

    /*
     * Defaults if no commission rule exists.
     */
    let commissionAmount = 0;

    let netPrincipalAmount = grossAmount;

    let result: Awaited<ReturnType<VimopayService['aadhaarPay']>>;

    /*
     * =====================================================
     * 4. PRE-PROVIDER
     * =====================================================
     */

    try {
      /*
       * ===================================================
       * >5000 APTFA AUTHORIZATION
       * ===================================================
       */

      if (grossAmount > 5000) {
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
         * Expired auth.
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
         * Authorization amount must match
         * GROSS transaction amount.
         */
        if (Number(authorization.amount) !== grossAmount) {
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
         * Atomic APTFA claim.
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

        cwAuthTxnId = authorization.providerTxnRefId;
      }

      /*
       * ===================================================
       * 5. CREATE CANONICAL PROVIDER TRANSACTION
       * ===================================================
       *
       * ProviderTransaction amount = GROSS.
       */

      const providerTransaction = await this.providerTransactionService.create({
        userId: context.identityId,

        serviceType: 'AEPS',

        provider: 'VIMOPAY',

        operation: 'AP',

        /*
         * GROSS.
         */
        amount: grossAmount,

        settlementRequired: true,

        idempotencyKey,

        merchantProfileId: merchant.profileId,

        providerMerchantId: merchant.merchantId,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),

        metadata: {
          category: 'FINANCIAL',

          accountingModel: 'GROSS_MINUS_COMMISSION',

          transactionOtpRequired: grossAmount > 5000,

          ...(dto.authRequestId
            ? {
                authRequestId: dto.authRequestId,
              }
            : {}),
        },
      });

      /*
       * Non-null local values.
       */
      const currentProviderTransactionId: string = providerTransaction.id;

      const currentProviderTransactionReferenceId: string =
        providerTransaction.referenceId;

      /*
       * Preserve outer state for catch
       * and later finalization.
       */
      providerTransactionId = currentProviderTransactionId;

      providerTransactionReferenceId = currentProviderTransactionReferenceId;

      /*
       * ===================================================
       * 6. PREPARE + SNAPSHOT COMMISSION
       * ===================================================
       *
       * IMPORTANT:
       *
       * Current dynamic CRUD state freezes here:
       *
       * - matched CommissionRule
       * - ALL active CommissionDistribution rows
       * - actual hierarchy recipients
       * - merchant remainder
       *
       * Future CRUD edits transaction ko
       * affect nahi karengi.
       */

      commissionPreparation = await this.commissionService.prepare({
        providerTransactionId: currentProviderTransactionId,

        providerTransactionReference: currentProviderTransactionReferenceId,

        userId: context.identityId,

        role: context.role,

        operation: 'AP',

        /*
         * Commission calculated on GROSS.
         */
        amount: grossAmount,
      });

      commissionAmount = Number(commissionPreparation.commissionAmount);

      netPrincipalAmount = Number(commissionPreparation.netAmount);

      /*
       * ===================================================
       * ACCOUNTING SAFETY
       * ===================================================
       */

      if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
        throw new Error('Invalid prepared commission amount');
      }

      if (!Number.isFinite(netPrincipalAmount) || netPrincipalAmount <= 0) {
        throw new Error('Invalid prepared net principal amount');
      }

      const grossPaise = Math.round(grossAmount * 100);

      const commissionPaise = Math.round(commissionAmount * 100);

      const netPaise = Math.round(netPrincipalAmount * 100);

      /*
       * GROSS = NET + COMMISSION.
       */
      if (netPaise + commissionPaise !== grossPaise) {
        throw new Error('Aadhaar Pay commission accounting mismatch');
      }

      /*
       * ===================================================
       * 7. PROVIDER MERCHANT REF
       * ===================================================
       */

      const currentMerchantRefId: string = this.generateMerchantRefId('AP');

      merchantRefId = currentMerchantRefId;

      /*
       * INITIATED → PROCESSING
       */
      await this.providerTransactionService.markProcessing(
        currentProviderTransactionReferenceId,

        currentMerchantRefId,
      );

      /*
       * ===================================================
       * 8. PROVIDER DTO
       * ===================================================
       *
       * VimoPay gets GROSS amount.
       */

      const providerDto: VimopayAadhaarPayDto = {
        merchantRefId: currentMerchantRefId,

        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        /*
         * Provider-facing amount remains
         * GROSS ₹150.
         */
        amount: dto.amount,

        bankIIN: dto.bankIIN,

        ipAddress: context.ipAddress,

        lat: dto.lat,

        long: dto.long,

        deviceType: dto.deviceType,

        /*
         * <=5000 → ''
         * >5000  → APTFA txnRefId
         */
        cwAuthTxnId,

        udf1: dto.udf1 ?? '',

        udf2: dto.udf2 ?? '',

        udf3: dto.udf3 ?? '',

        pidData: dto.pidData,
      };

      /*
       * ===================================================
       * 9. VIMOPAY CALL
       * ===================================================
       */

      providerCallStarted = true;

      result = await this.vimopayService.aadhaarPay(providerDto);
    } catch (error) {
      /*
       * ===================================================
       * PROVIDER CALL DID NOT START
       * ===================================================
       */

      if (!providerCallStarted) {
        /*
         * High-value authorization release.
         */
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

        /*
         * Provider call nahi hui.
         *
         * Local execution lock safely
         * release.
         *
         * PTXN + Commission snapshot
         * idempotently retryable rahenge.
         */
        await this.idempotencyService.abandonBeforeProvider(
          idempotency.recordId,

          idempotency.lockToken,
        );

        throw error;
      }

      /*
       * ===================================================
       * PROVIDER CALL STARTED — UNKNOWN RESULT
       * ===================================================
       */

      await this.idempotencyService.markUnknown(
        idempotency.recordId,

        idempotency.lockToken,
      );

      /*
       * High-value authorization uncertain.
       */
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

      /*
       * IMPORTANT:
       *
       * Commission snapshot cancel nahi
       * karenge because provider may have
       * actually succeeded.
       */

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
     * Provider definitive response available.
     * =====================================================
     */

    /*
     * =====================================================
     * 10. FINALIZE >5000 APTFA
     * =====================================================
     */

    if (grossAmount > 5000 && claimedAuthorizationId) {
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
     * 11. FINALIZE PROVIDER TRANSACTION
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

            accountingModel: 'GROSS_MINUS_COMMISSION',

            grossAmount: grossAmount.toFixed(2),

            commissionAmount: commissionAmount.toFixed(2),

            netPrincipalAmount: netPrincipalAmount.toFixed(2),

            transactionOtpRequired: grossAmount > 5000,
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
        'Unable to finalize canonical Aadhaar Pay transaction',

        error instanceof Error ? error.stack : undefined,
      );
    }

    /*
     * =====================================================
     * 12. PRINCIPAL SETTLEMENT STATE
     * =====================================================
     */

    let settlementStatus: 'NOT_REQUIRED' | 'PENDING' | 'SETTLED' =
      result.status === '001' || result.status === '003'
        ? 'NOT_REQUIRED'
        : 'PENDING';

    let settlementTransactionReference: string | null = null;

    /*
     * =====================================================
     * COMMISSION RESPONSE DEFAULT
     * =====================================================
     */

    let commissionResult: Awaited<ReturnType<AepsCommissionService['settle']>> =
      {
        status:
          commissionPreparation?.status === 'PREPARED'
            ? 'PENDING'
            : 'NOT_REQUIRED',

        amount: commissionPreparation?.commissionAmount ?? '0.00',

        grossAmount: grossAmount.toFixed(2),

        netAmount: netPrincipalAmount.toFixed(2),

        commissionReference: commissionPreparation?.commissionReference ?? null,

        walletTransactionReference: null,

        distributions: [],

        ...(commissionPreparation?.reason
          ? {
              reason: commissionPreparation.reason,
            }
          : {}),
      };

    /*
     * =====================================================
     * 13. PROVIDER SUCCESS
     * =====================================================
     */

    if (result.status === '000') {
      /*
       * AP AEPS wallet receives NET.
       *
       * Example:
       *
       * Gross      ₹150
       * Commission ₹10
       * AEPS       +₹140
       */
      try {
        const settlement = await this.walletService.settlePrincipal({
          userId: context.identityId,

          providerTransactionReference: providerTransactionReferenceId!,

          operation: 'AP',

          grossAmount,

          netAmount: netPrincipalAmount,
        });

        settlementStatus = 'SETTLED';

        settlementTransactionReference = settlement.referenceId;
      } catch (error) {
        settlementStatus = 'PENDING';

        this.logger.error(
          'AP provider success but AEPS net principal settlement is pending',

          error instanceof Error ? error.stack : undefined,
        );
      }

      /*
       * ===================================================
       * EXECUTE ALL SNAPSHOTTED DISTRIBUTIONS
       * ===================================================
       */

      if (settlementStatus === 'SETTLED') {
        if (
          commissionPreparation?.status === 'PREPARED' &&
          providerTransactionId
        ) {
          try {
            /*
             * Same commission idempotency
             * key is reused.
             *
             * Therefore settle() executes
             * the PREVIOUSLY snapshotted
             * multiple distributions.
             */
            commissionResult = await this.commissionService.settle({
              providerTransactionId,

              providerTransactionReference: providerTransactionReferenceId!,

              userId: context.identityId,

              role: context.role,

              operation: 'AP',

              /*
               * GROSS.
               */
              amount: grossAmount,
            });
          } catch (error) {
            commissionResult = {
              status: 'PENDING',

              amount: commissionAmount.toFixed(2),

              grossAmount: grossAmount.toFixed(2),

              netAmount: netPrincipalAmount.toFixed(2),

              commissionReference: commissionPreparation.commissionReference,

              walletTransactionReference: null,

              distributions: [],

              reason: 'COMMISSION_SETTLEMENT_PENDING',
            };

            this.logger.error(
              'AP commission distribution settlement failed',

              error instanceof Error ? error.stack : undefined,
            );

            try {
              await this.providerTransactionService.updateCommissionState({
                referenceId: providerTransactionReferenceId!,

                status: 'PENDING',

                commissionReferenceId:
                  commissionPreparation.commissionReference ?? undefined,

                commissionAmount,

                failureReason:
                  error instanceof Error
                    ? error.message
                    : 'Commission settlement failed',
              });
            } catch {
              /*
               * Preserve provider result.
               */
            }
          }
        } else {
          /*
           * No commission was configured
           * at transaction start.
           *
           * IMPORTANT:
           * do NOT recalculate now.
           */
          commissionResult = {
            status: 'NOT_REQUIRED',

            amount: '0.00',

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: null,

            walletTransactionReference: null,

            distributions: [],

            reason: commissionPreparation?.reason ?? 'NO_COMMISSION',
          };
        }
      } else {
        /*
         * Provider success,
         * principal settlement pending.
         *
         * Commission distributions wait.
         */
        if (commissionPreparation?.status === 'PREPARED') {
          commissionResult = {
            status: 'PENDING',

            amount: commissionAmount.toFixed(2),

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: commissionPreparation.commissionReference,

            walletTransactionReference: null,

            distributions: [],

            reason: 'WAITING_FOR_PRINCIPAL_SETTLEMENT',
          };

          try {
            await this.providerTransactionService.updateCommissionState({
              referenceId: providerTransactionReferenceId!,

              status: 'PENDING',

              commissionReferenceId:
                commissionPreparation.commissionReference ?? undefined,

              commissionAmount,

              failureReason: 'Waiting for AEPS net principal settlement',
            });
          } catch {
            /*
             * Continue response.
             */
          }
        }
      }
    }

    /*
     * =====================================================
     * 14. PROVIDER DEFINITIVE FAILURE
     * =====================================================
     */

    if (result.status === '001' || result.status === '003') {
      /*
       * No AEPS principal credit.
       *
       * Prepared commission snapshot
       * must be cancelled.
       */

      if (commissionPreparation?.status === 'PREPARED') {
        try {
          await this.commissionService.cancel({
            providerTransactionReference: providerTransactionReferenceId!,

            commissionReference: commissionPreparation.commissionReference,

            reason: `Aadhaar Pay provider failed: ${result.statusDescription}`,
          });

          commissionResult = {
            status: 'NOT_REQUIRED',

            amount: '0.00',

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: commissionPreparation.commissionReference,

            walletTransactionReference: null,

            distributions: [],

            reason: 'PROVIDER_TRANSACTION_FAILED_COMMISSION_CANCELLED',
          };
        } catch (error) {
          commissionResult = {
            status: 'PENDING',

            amount: commissionAmount.toFixed(2),

            grossAmount: grossAmount.toFixed(2),

            netAmount: netPrincipalAmount.toFixed(2),

            commissionReference: commissionPreparation.commissionReference,

            walletTransactionReference: null,

            distributions: [],

            reason: 'COMMISSION_CANCELLATION_PENDING',
          };

          this.logger.error(
            'Unable to cancel failed AP commission snapshot',

            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * 15. PROVIDER PENDING
     * =====================================================
     */

    if (result.status === '002') {
      /*
       * Snapshot remains frozen.
       *
       * No AEPS credit.
       * No PROFIT distributions.
       */
      if (commissionPreparation?.status === 'PREPARED') {
        commissionResult = {
          status: 'PENDING',

          amount: commissionAmount.toFixed(2),

          grossAmount: grossAmount.toFixed(2),

          netAmount: netPrincipalAmount.toFixed(2),

          commissionReference: commissionPreparation.commissionReference,

          walletTransactionReference: null,

          distributions: [],

          reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
        };
      }
    }

    /*
     * Unexpected provider status →
     * canonical UNKNOWN.
     */

    if (
      !['000', '001', '002', '003'].includes(result.status) &&
      commissionPreparation?.status === 'PREPARED'
    ) {
      commissionResult = {
        status: 'PENDING',

        amount: commissionAmount.toFixed(2),

        grossAmount: grossAmount.toFixed(2),

        netAmount: netPrincipalAmount.toFixed(2),

        commissionReference: commissionPreparation.commissionReference,

        walletTransactionReference: null,

        distributions: [],

        reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
      };
    }

    /*
     * =====================================================
     * 16. FINAL RESPONSE
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
       * Existing amount remains GROSS.
       */
      amount: dto.amount,

      /*
       * Explicit internal accounting.
       */
      accounting: {
        grossAmount: grossAmount.toFixed(2),

        commissionAmount: commissionAmount.toFixed(2),

        netPrincipalAmount: netPrincipalAmount.toFixed(2),
      },

      result,

      /*
       * Actual AEPS wallet movement.
       */
      settlement: {
        status: settlementStatus,

        walletType: result.status === '000' ? 'AEPS' : null,

        amount: result.status === '000' ? netPrincipalAmount.toFixed(2) : null,

        transactionReference: settlementTransactionReference,
      },

      /*
       * Can contain MULTIPLE
       * distribution transactions.
       */
      commission: commissionResult,
    };

    /*
     * =====================================================
     * 17. COMPLETE IDEMPOTENCY
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

  async cashDeposit(
    context: VimopayTransactionContext,
    dto: VimopayCashDepositRequestDto,
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

    const requestHash = this.idempotencyService.createRequestHash({
      transactionType: 'CD',

      amount: amount.toFixed(2),

      bankIIN: dto.bankIIN,

      aadhaarNumber: dto.aadhaarNumber,

      mobileNumber: dto.mobileNumber,
    });

    const idempotency = await this.idempotencyService.begin({
      identityId: context.identityId,

      profileId: merchant.profileId,

      transactionType: AepsFinancialTransactionType.CASH_DEPOSIT,

      idempotencyKey,

      requestHash,
    });

    /*
     * Same financial request already
     * process ho chuki hai.
     */
    if (!idempotency.shouldExecute) {
      return idempotency.response;
    }

    /*
     * =====================================================
     * 3. ATOMIC PROVIDER TRANSACTION + AEPS PRE-DEBIT
     * =====================================================
     *
     * CD mein provider ko call karne se PEHLE
     * merchant AEPS wallet debit/reserve hoti hai.
     */

    let prepared: any;

    try {
      prepared = await this.walletService.prepareCashDeposit({
        userId: context.identityId,

        providerTransactionIdempotencyKey: idempotencyKey,

        merchantProfileId: merchant.profileId,

        providerMerchantId: merchant.merchantId,

        amount,

        bankIIN: dto.bankIIN,

        aadhaarLast4: dto.aadhaarNumber.slice(-4),
      });
    } catch (error) {
      /*
       * Wallet reservation failed.
       *
       * Provider ko request nahi gayi,
       * so AEPS idempotency reservation
       * safely release kar sakte hain.
       */

      await this.idempotencyService.abandonBeforeProvider(
        idempotency.recordId,

        idempotency.lockToken,
      );

      throw error;
    }

    const providerTransaction = prepared.providerTransaction;

    const reservationTransaction = prepared.walletTransaction;

    /*
     * Canonical references.
     */
    const providerTransactionReferenceId: string =
      providerTransaction.referenceId;

    /*
     * Commission service ko actual
     * ProviderTransaction UUID chahiye.
     */
    const providerTransactionId: string = providerTransaction.id;

    /*
     * =====================================================
     * 4. PROVIDER MERCHANT REF
     * =====================================================
     */

    const merchantRefId = this.generateMerchantRefId('CD');

    /*
     * INITIATED → PROCESSING
     */
    try {
      await this.providerTransactionService.markProcessing(
        providerTransactionReferenceId,

        merchantRefId,
      );
    } catch (error) {
      /*
       * IMPORTANT:
       *
       * Wallet already pre-debit ho chuki hai.
       * Isliye silently provider call continue
       * nahi karenge.
       *
       * Existing reservation state preserve rahegi
       * for reconciliation.
       */

      this.logger.error(
        'Unable to mark Cash Deposit provider transaction as processing',

        error instanceof Error ? error.stack : undefined,
      );

      await this.idempotencyService.markUnknown(
        idempotency.recordId,

        idempotency.lockToken,
      );

      throw error;
    }

    /*
     * =====================================================
     * 5. VIMOPAY PROVIDER CALL
     * =====================================================
     */

    let result: Awaited<ReturnType<VimopayService['cashDeposit']>>;

    try {
      result = await this.vimopayService.cashDeposit({
        merchantRefId,

        merchantId: merchant.merchantId,

        aadhaarNumber: dto.aadhaarNumber,

        mobileNumber: dto.mobileNumber,

        amount: dto.amount,

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
       * Provider request start ho gayi,
       * but definitive result nahi mila.
       *
       * IMPORTANT:
       *
       * AEPS pre-debit auto refund nahi hogi.
       *
       * Ho sakta hai provider side transaction
       * actually successful hui ho.
       */

      await this.idempotencyService.markUnknown(
        idempotency.recordId,

        idempotency.lockToken,
      );

      try {
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransactionReferenceId,

          providerMerchantRefId: merchantRefId,

          reason:
            error instanceof Error
              ? error.message
              : 'VimoPay Cash Deposit request failed',
        });
      } catch (trackingError) {
        this.logger.error(
          'Unable to mark Cash Deposit transaction UNKNOWN',

          trackingError instanceof Error ? trackingError.stack : undefined,
        );
      }

      throw error;
    }

    /*
     * =====================================================
     * Provider ka definitive response mil chuka hai.
     *
     * Is point ke baad local failure ko provider
     * failure nahi bolenge.
     * =====================================================
     */

    /*
     * =====================================================
     * 6. FINALIZE CANONICAL PROVIDER TRANSACTION
     * =====================================================
     */

    const finalStatus = this.mapProviderTransactionStatus(result.status);

    try {
      if (finalStatus) {
        await this.providerTransactionService.finalize({
          referenceId: providerTransactionReferenceId,

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
          },
        });
      } else {
        await this.providerTransactionService.markUnknown({
          referenceId: providerTransactionReferenceId,

          providerMerchantRefId: merchantRefId,

          reason: `Unexpected VimoPay transaction status: ${result.status}`,
        });
      }
    } catch (error) {
      /*
       * Provider ka definitive result
       * already mil chuka hai.
       *
       * Transaction tracking failure ko
       * provider failure nahi bolenge.
       */

      this.logger.error(
        'Unable to finalize canonical Cash Deposit transaction',

        error instanceof Error ? error.stack : undefined,
      );
    }

    /*
     * =====================================================
     * 7. PRINCIPAL SETTLEMENT RESULT
     * =====================================================
     */

    let settlementStatus: 'RESERVED' | 'SETTLED' | 'COMPENSATED' = 'RESERVED';

    /*
     * Ye original AEPS DEBIT transaction hai.
     */
    const settlementTransactionReference: string =
      reservationTransaction.referenceId;

    let compensationTransactionReference: string | null = null;

    /*
     * =====================================================
     * PROVIDER SUCCESS
     * =====================================================
     *
     * Original pre-debit now final settlement.
     */

    if (result.status === '000') {
      try {
        await this.walletService.confirmCashDeposit({
          userId: context.identityId,

          providerTransactionReference: providerTransactionReferenceId,
        });

        settlementStatus = 'SETTLED';
      } catch (error) {
        /*
         * Provider transaction SUCCESS hai.
         *
         * Money already AEPS wallet se debit hai.
         *
         * Confirmation failed hone par
         * compensation nahi karenge.
         *
         * Internal reconciliation confirm karegi.
         */

        settlementStatus = 'RESERVED';

        this.logger.error(
          'CD succeeded but AEPS reservation confirmation is pending',

          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    /*
     * =====================================================
     * PROVIDER DEFINITIVE FAILURE
     * =====================================================
     *
     * Original pre-DEBIT merchant ko
     * return karni hai.
     */

    if (result.status === '001' || result.status === '003') {
      try {
        const compensation = await this.walletService.compensateCashDeposit({
          userId: context.identityId,

          providerTransactionReference: providerTransactionReferenceId,

          amount,
        });

        settlementStatus = 'COMPENSATED';

        compensationTransactionReference = compensation.referenceId;
      } catch (error) {
        /*
         * Provider FAILED confirmed hai,
         * but refund/compensation pending hai.
         *
         * Debit RESERVED state mein rahegi
         * until reconciliation.
         */

        settlementStatus = 'RESERVED';

        this.logger.error(
          'CD failed but AEPS wallet compensation is pending',

          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    /*
     * =====================================================
     * Provider PENDING / unexpected:
     * =====================================================
     *
     * Original debit reserve rahegi.
     *
     * No automatic credit/refund.
     */

    /*
     * =====================================================
     * 8. COMMISSION SETTLEMENT
     * =====================================================
     *
     * Commission ONLY:
     *
     * Provider SUCCESS
     * +
     * Principal settlement SETTLED
     *
     * hone ke baad PROFIT wallet mein credit hogi.
     */

    type CashDepositCommissionResult = {
      status: 'NOT_REQUIRED' | 'PENDING' | 'SETTLED';

      amount: string | null;

      commissionReference: string | null;

      walletTransactionReference: string | null;

      reason?: string;
    };

    /*
     * commissionService.settle() ke inferred
     * return type issue avoid karne ke liye
     * normalize karenge.
     */

    type RawCommissionResult = {
      status?: string;

      amount?: string | number | null;

      commissionReference?: string | null;

      walletTransactionReference?: string | null;

      reason?: string;
    };

    let commissionResult: CashDepositCommissionResult = {
      status: 'NOT_REQUIRED',

      amount: null,

      commissionReference: null,

      walletTransactionReference: null,
    };

    /*
     * =====================================================
     * CD SUCCESS + PRINCIPAL SETTLED
     * =====================================================
     */

    if (result.status === '000') {
      if (settlementStatus === 'SETTLED') {
        try {
          const settledCommission = (await this.commissionService.settle({
            providerTransactionId,

            providerTransactionReference: providerTransactionReferenceId,

            userId: context.identityId,

            /*
             * Trusted JWT role.
             */
            role: context.role,

            operation: 'CD',

            amount,
          })) as RawCommissionResult;

          /*
           * Normalize commission state.
           */

          let normalizedStatus: CashDepositCommissionResult['status'];

          if (settledCommission.status === 'SETTLED') {
            normalizedStatus = 'SETTLED';
          } else if (settledCommission.status === 'NOT_REQUIRED') {
            normalizedStatus = 'NOT_REQUIRED';
          } else {
            normalizedStatus = 'PENDING';
          }

          commissionResult = {
            status: normalizedStatus,

            amount:
              settledCommission.amount === null ||
              settledCommission.amount === undefined
                ? null
                : String(settledCommission.amount),

            commissionReference: settledCommission.commissionReference ?? null,

            walletTransactionReference:
              settledCommission.walletTransactionReference ?? null,

            ...(settledCommission.reason
              ? {
                  reason: settledCommission.reason,
                }
              : {}),
          };
        } catch (error) {
          /*
           * Provider + principal transaction
           * already successful hain.
           *
           * Commission failure unko rollback
           * nahi karegi.
           */

          commissionResult = {
            status: 'PENDING',

            amount: null,

            commissionReference: null,

            walletTransactionReference: null,

            reason: 'COMMISSION_SETTLEMENT_PENDING',
          };

          this.logger.error(
            'CD commission settlement failed',

            error instanceof Error ? error.stack : undefined,
          );

          try {
            await this.providerTransactionService.updateCommissionState({
              referenceId: providerTransactionReferenceId,

              status: 'PENDING',

              failureReason:
                error instanceof Error
                  ? error.message
                  : 'Cash Deposit commission settlement failed',
            });
          } catch (stateError) {
            this.logger.error(
              'Unable to mark CD commission pending',

              stateError instanceof Error ? stateError.stack : undefined,
            );
          }
        }
      } else {
        /*
         * Provider SUCCESS hai,
         * but principal reservation
         * SETTLED nahi hui.
         *
         * Commission abhi nahi denge.
         */

        commissionResult = {
          status: 'PENDING',

          amount: null,

          commissionReference: null,

          walletTransactionReference: null,

          reason: 'WAITING_FOR_PRINCIPAL_SETTLEMENT',
        };

        try {
          await this.providerTransactionService.updateCommissionState({
            referenceId: providerTransactionReferenceId,

            status: 'PENDING',

            failureReason: 'Waiting for AEPS Cash Deposit principal settlement',
          });
        } catch (error) {
          this.logger.error(
            'Unable to mark CD commission pending',

            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }

    /*
     * =====================================================
     * PROVIDER PENDING / UNKNOWN
     * =====================================================
     *
     * Commission tab tak pending.
     */

    if (
      result.status !== '000' &&
      result.status !== '001' &&
      result.status !== '003'
    ) {
      commissionResult = {
        status: 'PENDING',

        amount: null,

        commissionReference: null,

        walletTransactionReference: null,

        reason: 'WAITING_FOR_PROVIDER_RESOLUTION',
      };

      try {
        await this.providerTransactionService.updateCommissionState({
          referenceId: providerTransactionReferenceId,

          status: 'PENDING',

          failureReason:
            'Waiting for Cash Deposit provider transaction resolution',
        });
      } catch (error) {
        this.logger.error(
          'Unable to mark pending CD commission state',

          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    /*
     * Provider definitive FAILED:
     *
     * Commission remains NOT_REQUIRED.
     *
     * No PROFIT credit.
     */

    /*
     * =====================================================
     * 9. FINAL API RESPONSE
     * =====================================================
     */

    const response = {
      provider: 'VIMOPAY',

      transactionType: 'CD',

      transactionReferenceId: providerTransactionReferenceId,

      profileId: merchant.profileId,

      merchantRefId,

      providerMerchantId: merchant.merchantId,

      amount: dto.amount,

      result,

      /*
       * AEPS principal debit state.
       */
      settlement: {
        status: settlementStatus,

        walletType: 'AEPS',

        transactionReference: settlementTransactionReference,

        compensationTransactionReference,
      },

      /*
       * PROFIT wallet commission state.
       */
      commission: commissionResult,
    };

    /*
     * =====================================================
     * 10. COMPLETE IDEMPOTENCY
     * =====================================================
     *
     * Final response tab cache hogi jab:
     *
     * provider result
     * + principal settlement
     * + commission result
     *
     * determine ho chuke hon.
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
      /*
       * Provider already definitive hai.
       *
       * Principal/commission wallet entries
       * rollback nahi karenge.
       */

      this.logger.error(
        'Cash Deposit idempotency finalization failed',

        error instanceof Error ? error.stack : undefined,
      );
    }

    /*
     * =====================================================
     * 11. RETURN
     * =====================================================
     */

    return response;
  }
}
