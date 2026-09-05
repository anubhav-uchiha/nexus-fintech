import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { createHash, randomUUID } from 'crypto';

import {
  AepsFinancialTransactionType,
  AepsIdempotencyStatus,
  AepsProvider,
} from '../../../../generated/prisma/enums';

import { PrismaService } from '../../../database/prisma.service';

interface BeginInput {
  identityId: string;

  profileId: string;

  transactionType: AepsFinancialTransactionType;

  idempotencyKey: string;

  /*
   * Complete request fingerprint.
   *
   * Used for:
   * same Idempotency-Key +
   * different request => 409
   */
  requestHash: string;

  /*
   * Stable business transaction intent.
   *
   * Must NOT contain volatile things
   * like fresh biometric PID payload.
   *
   * Optional temporarily for backward
   * compatibility. Until callers are
   * upgraded, requestHash is used.
   */
  intentHash?: string;
}

interface CompleteInput {
  recordId: string;

  lockToken: string;

  response: unknown;

  providerStatusCode?: string;

  providerMerchantRefId?: string;

  providerTxnRefId?: string;
}

interface ResolveAfterReconciliationInput {
  identityId: string;

  transactionType: AepsFinancialTransactionType;

  resolution: 'SUCCESS' | 'FAILED';

  response: unknown;

  idempotencyKey?: string;

  providerMerchantRefId?: string;

  providerTxnRefId?: string;
}

@Injectable()
export class VimopayIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /*
   * =====================================================
   * CANONICAL JSON
   * =====================================================
   *
   * JSON.stringify() directly use karne par
   * object key order hash change kar sakta hai.
   *
   * Example:
   *
   * { amount: 100, bankIIN: '123' }
   *
   * vs
   *
   * { bankIIN: '123', amount: 100 }
   *
   * logically same payload hai.
   */

  private normalizeForHash(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Buffer.isBuffer(value)) {
      return value.toString('base64');
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForHash(item));
    }

    if (typeof value === 'object') {
      const source = value as Record<string, unknown>;

      const output: Record<string, unknown> = {};

      Object.keys(source)
        .sort()
        .forEach((key) => {
          const normalized = this.normalizeForHash(source[key]);

          if (normalized !== undefined) {
            output[key] = normalized;
          }
        });

      return output;
    }

    return value;
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const normalized = this.normalizeForHash(payload);

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /*
   * =====================================================
   * FULL REQUEST HASH
   * =====================================================
   */

  createRequestHash(payload: Record<string, unknown>): string {
    return this.hashPayload(payload);
  }

  /*
   * =====================================================
   * BUSINESS INTENT HASH
   * =====================================================
   *
   * Caller stable financial fields pass karega.
   *
   * Example:
   *
   * transactionType
   * profileId
   * amount
   * bankIIN
   * aadhaar fingerprint
   *
   * PID / biometric raw response / OTP ko
   * yahan include nahi karna.
   */

  createIntentHash(payload: Record<string, unknown>): string {
    return this.hashPayload(payload);
  }

  /*
   * =====================================================
   * BEGIN
   * =====================================================
   */

  async begin(input: BeginInput) {
    if (!input.idempotencyKey?.trim()) {
      throw new ConflictException({
        message: 'Idempotency-Key is required',

        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const intentHash = input.intentHash ?? input.requestHash;

    const lockToken = randomUUID();

    /*
     * We need TWO locks:
     *
     * 1. Same idempotency key
     * 2. Same financial intent
     *
     * Otherwise parallel HTTP requests
     * can both pass the initial lookup
     * before either row gets created.
     */

    const idempotencyLockKey = [
      'VIMOPAY',
      'IDEMPOTENCY',
      input.identityId,
      input.transactionType,
      input.idempotencyKey,
    ].join(':');

    const intentLockKey = [
      'VIMOPAY',
      'INTENT',
      input.identityId,
      input.profileId,
      input.transactionType,
      intentHash,
    ].join(':');

    /*
     * Deterministic ordering avoids
     * advisory-lock deadlocks.
     */
    const lockKeys = [idempotencyLockKey, intentLockKey].sort();

    return this.prisma.$transaction(async (tx) => {
      /*
       * PostgreSQL transaction-level
       * advisory locks.
       *
       * Automatically released when
       * this DB transaction finishes.
       */

      for (const key of lockKeys) {
        await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${key})::bigint
            )
          `;
      }

      /*
       * =================================================
       * SAME FINANCIAL INTENT CHECK
       * =================================================
       *
       * Different Idempotency-Key
       * cannot bypass an unresolved
       * financial intent.
       */

      const unsettled = await tx.aepsTransactionIdempotency.findFirst({
        where: {
          identityId: input.identityId,

          profileId: input.profileId,

          provider: AepsProvider.VIMOPAY,

          transactionType: input.transactionType,

          /*
           * New records use intentHash.
           *
           * Old records may have null
           * because field was added later.
           */
          OR: [
            {
              intentHash,
            },

            /*
             * Legacy records created before
             * intentHash column existed.
             */
            {
              intentHash: null,

              requestHash: input.requestHash,
            },
          ],

          idempotencyKey: {
            not: input.idempotencyKey,
          },

          status: {
            in: [
              AepsIdempotencyStatus.PROCESSING,

              AepsIdempotencyStatus.PENDING,

              AepsIdempotencyStatus.UNKNOWN,
            ],
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

      if (unsettled) {
        switch (unsettled.status) {
          case AepsIdempotencyStatus.PROCESSING:
            throw new ConflictException({
              message: 'A matching transaction is already being processed',

              code: 'TRANSACTION_IN_PROGRESS',

              existingIdempotencyKey: unsettled.idempotencyKey,
            });

          case AepsIdempotencyStatus.PENDING:
            throw new ConflictException({
              message: 'A previous matching transaction is still pending',

              code: 'PREVIOUS_TRANSACTION_PENDING',

              existingIdempotencyKey: unsettled.idempotencyKey,
            });

          case AepsIdempotencyStatus.UNKNOWN:
            throw new ConflictException({
              message:
                'A previous matching transaction has an uncertain status and must be reconciled before retry',

              code: 'PREVIOUS_TRANSACTION_UNKNOWN',

              existingIdempotencyKey: unsettled.idempotencyKey,
            });
        }
      }

      /*
       * =================================================
       * CREATE OR LOAD IDEMPOTENCY RECORD
       * =================================================
       */

      const record = await tx.aepsTransactionIdempotency.upsert({
        where: {
          identityId_provider_transactionType_idempotencyKey: {
            identityId: input.identityId,

            provider: AepsProvider.VIMOPAY,

            transactionType: input.transactionType,

            idempotencyKey: input.idempotencyKey,
          },
        },

        create: {
          identityId: input.identityId,

          profileId: input.profileId,

          provider: AepsProvider.VIMOPAY,

          transactionType: input.transactionType,

          idempotencyKey: input.idempotencyKey,

          requestHash: input.requestHash,

          intentHash,

          lockToken,

          status: AepsIdempotencyStatus.PROCESSING,
        },

        /*
         * Existing row immutable.
         */
        update: {},
      });

      /*
       * =================================================
       * SAME KEY + DIFFERENT REQUEST
       * =================================================
       *
       * Requirement:
       *
       * same key
       * different financial request
       * => HTTP 409
       */

      if (record.requestHash !== input.requestHash) {
        throw new ConflictException({
          message:
            'Idempotency-Key has already been used for a different request',

          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }

      /*
       * Intent mismatch on same key
       * must also never happen.
       */

      if (record.intentHash && record.intentHash !== intentHash) {
        throw new ConflictException({
          message: 'Idempotency-Key belongs to a different transaction intent',

          code: 'IDEMPOTENCY_INTENT_MISMATCH',
        });
      }

      /*
       * =================================================
       * NEW RECORD
       * =================================================
       */

      if (record.lockToken === lockToken) {
        return {
          shouldExecute: true as const,

          recordId: record.id,

          lockToken,
        };
      }

      /*
       * =================================================
       * EXISTING FINAL / PROVIDER RESPONSE
       * =================================================
       */

      const reusableStatuses: AepsIdempotencyStatus[] = [
        AepsIdempotencyStatus.SUCCESS,

        AepsIdempotencyStatus.FAILED,

        AepsIdempotencyStatus.PENDING,
      ];

      if (reusableStatuses.includes(record.status)) {
        if (!record.response) {
          throw new InternalServerErrorException(
            'Stored idempotent transaction response is missing',
          );
        }

        /*
         * Same key never calls
         * VimoPay again.
         */
        return {
          shouldExecute: false as const,

          response: record.response,
        };
      }

      /*
       * =================================================
       * SAME REQUEST CURRENTLY RUNNING
       * =================================================
       */

      if (record.status === AepsIdempotencyStatus.PROCESSING) {
        throw new ConflictException({
          message: 'This transaction request is already being processed',

          code: 'TRANSACTION_IN_PROGRESS',
        });
      }

      /*
       * =================================================
       * UNKNOWN
       * =================================================
       *
       * Never automatically call
       * VimoPay again.
       */

      throw new ConflictException({
        message:
          'Transaction status is uncertain and must be reconciled before retry',

        code: 'TRANSACTION_STATUS_UNKNOWN',
      });
    });
  }

  /*
   * =====================================================
   * COMPLETE AFTER PROVIDER RESPONSE
   * =====================================================
   */

  async complete(input: CompleteInput) {
    const providerStatus = input.providerStatusCode ?? '';

    const status = this.mapProviderStatus(providerStatus);

    const updated = await this.prisma.aepsTransactionIdempotency.updateMany({
      where: {
        id: input.recordId,

        lockToken: input.lockToken,

        status: AepsIdempotencyStatus.PROCESSING,
      },

      data: {
        status,

        providerMerchantRefId: input.providerMerchantRefId,

        providerTxnRefId: input.providerTxnRefId,

        providerStatusCode: providerStatus || null,

        response: input.response as object,

        completedAt: new Date(),

        lockToken: null,
      },
    });

    if (updated.count !== 1) {
      throw new InternalServerErrorException(
        'Unable to finalize transaction idempotency record',
      );
    }
  }

  /*
   * =====================================================
   * LOCAL FAILURE BEFORE PROVIDER CALL
   * =====================================================
   *
   * Safe to remove reservation because
   * VimoPay was never called.
   */

  async abandonBeforeProvider(recordId: string, lockToken: string) {
    await this.prisma.aepsTransactionIdempotency.deleteMany({
      where: {
        id: recordId,

        lockToken,

        status: AepsIdempotencyStatus.PROCESSING,
      },
    });
  }

  /*
   * =====================================================
   * PROVIDER CALL STARTED BUT RESULT UNCERTAIN
   * =====================================================
   */

  async markUnknown(
    recordId: string,

    lockToken: string,

    providerMerchantRefId?: string,
  ) {
    await this.prisma.aepsTransactionIdempotency.updateMany({
      where: {
        id: recordId,

        lockToken,

        status: AepsIdempotencyStatus.PROCESSING,
      },

      data: {
        status: AepsIdempotencyStatus.UNKNOWN,

        ...(providerMerchantRefId
          ? {
              providerMerchantRefId,
            }
          : {}),

        lockToken: null,
      },
    });
  }

  /*
   * =====================================================
   * RECONCILIATION → IDEMPOTENCY SYNC
   * =====================================================
   *
   * Very important:
   *
   * Suppose provider initially returned:
   *
   * PENDING
   *
   * and admin later reconciles PTXN as:
   *
   * SUCCESS
   *
   * ProviderTransaction alone update karna
   * enough nahi hai.
   *
   * Idempotency row bhi SUCCESS karni hogi,
   * otherwise future identical intent
   * permanently PREVIOUS_TRANSACTION_PENDING
   * se blocked rahega.
   *
   * Is method ko reconciliation bridge
   * se call karenge.
   */

  async resolveAfterReconciliation(input: ResolveAfterReconciliationInput) {
    /*
     * =====================================================
     * 1. VALIDATION
     * =====================================================
     */

    if (!input.identityId?.trim()) {
      throw new ConflictException({
        message: 'Identity ID is required for idempotency reconciliation',

        code: 'IDEMPOTENCY_IDENTITY_REQUIRED',
      });
    }

    if (
      !input.idempotencyKey &&
      !input.providerMerchantRefId &&
      !input.providerTxnRefId
    ) {
      throw new ConflictException({
        message:
          'Idempotency key or provider reference is required to resolve idempotency record',

        code: 'IDEMPOTENCY_REFERENCE_REQUIRED',
      });
    }

    /*
     * =====================================================
     * 2. TARGET FINAL STATUS
     * =====================================================
     */

    const targetStatus =
      input.resolution === 'SUCCESS'
        ? AepsIdempotencyStatus.SUCCESS
        : AepsIdempotencyStatus.FAILED;

    /*
     * =====================================================
     * 3. FIND MATCHING IDEMPOTENCY RECORD
     * =====================================================
     */

    const OR: any[] = [];

    if (input.idempotencyKey) {
      OR.push({
        idempotencyKey: input.idempotencyKey,
      });
    }

    if (input.providerMerchantRefId) {
      OR.push({
        providerMerchantRefId: input.providerMerchantRefId,
      });
    }

    if (input.providerTxnRefId) {
      OR.push({
        providerTxnRefId: input.providerTxnRefId,
      });
    }

    const record = await this.prisma.aepsTransactionIdempotency.findFirst({
      where: {
        identityId: input.identityId,

        provider: AepsProvider.VIMOPAY,

        transactionType: input.transactionType,

        OR,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    /*
     * =====================================================
     * 4. OLD / MISSING RECORD
     * =====================================================
     *
     * PTXN reconciliation ko fail nahi karenge
     * just because legacy idempotency row nahi mili.
     */

    if (!record) {
      return {
        updated: false,

        reason: 'IDEMPOTENCY_RECORD_NOT_FOUND',
      };
    }

    /*
     * =====================================================
     * 5. ALREADY SAME FINAL STATE
     * =====================================================
     */

    if (record.status === targetStatus) {
      return {
        updated: false,

        duplicate: true,

        recordId: record.id,

        status: record.status,
      };
    }

    /*
     * =====================================================
     * 6. PROTECT CONFLICTING FINAL STATE
     * =====================================================
     *
     * SUCCESS ko later FAILED ya
     * FAILED ko later SUCCESS silently
     * overwrite nahi karenge.
     */

    if (
      record.status === AepsIdempotencyStatus.SUCCESS ||
      record.status === AepsIdempotencyStatus.FAILED
    ) {
      throw new ConflictException({
        message: `Idempotency record is already finalized as ${record.status}`,

        code: 'IDEMPOTENCY_ALREADY_FINALIZED',
      });
    }

    /*
     * Only unresolved states can move:
     *
     * PROCESSING
     * PENDING
     * UNKNOWN
     */

    if (
      ![
        AepsIdempotencyStatus.PROCESSING,
        AepsIdempotencyStatus.PENDING,
        AepsIdempotencyStatus.UNKNOWN,
      ].includes(record.status)
    ) {
      throw new ConflictException({
        message: `Idempotency record cannot be reconciled from ${record.status}`,

        code: 'INVALID_IDEMPOTENCY_RECONCILIATION_STATE',
      });
    }

    /*
     * =====================================================
     * 7. UPDATE
     * =====================================================
     */

    const providerStatusCode = input.resolution === 'SUCCESS' ? '000' : '001';

    const updated = await this.prisma.aepsTransactionIdempotency.updateMany({
      where: {
        id: record.id,

        status: {
          in: [
            AepsIdempotencyStatus.PROCESSING,

            AepsIdempotencyStatus.PENDING,

            AepsIdempotencyStatus.UNKNOWN,
          ],
        },
      },

      data: {
        status: targetStatus,

        providerStatusCode,

        providerMerchantRefId:
          input.providerMerchantRefId ?? record.providerMerchantRefId,

        providerTxnRefId: input.providerTxnRefId ?? record.providerTxnRefId,

        response: input.response as object,

        completedAt: new Date(),

        lockToken: null,
      },
    });

    /*
     * Concurrent sync safety.
     */

    if (updated.count !== 1) {
      const latest = await this.prisma.aepsTransactionIdempotency.findUnique({
        where: {
          id: record.id,
        },
      });

      if (latest?.status === targetStatus) {
        return {
          updated: false,

          duplicate: true,

          recordId: latest.id,

          status: latest.status,
        };
      }

      throw new ConflictException({
        message: 'Idempotency state changed during reconciliation',

        code: 'IDEMPOTENCY_RECONCILIATION_CONFLICT',
      });
    }

    return {
      updated: true,

      duplicate: false,

      recordId: record.id,

      previousStatus: record.status,

      status: targetStatus,
    };
  }

  /*
   * =====================================================
   * PROVIDER STATUS MAPPING
   * =====================================================
   */

  private mapProviderStatus(providerStatus: string): AepsIdempotencyStatus {
    switch (providerStatus) {
      case '000':
        return AepsIdempotencyStatus.SUCCESS;

      case '001':

      case '003':
        return AepsIdempotencyStatus.FAILED;

      case '002':
        return AepsIdempotencyStatus.PENDING;

      default:
        return AepsIdempotencyStatus.UNKNOWN;
    }
  }
}
