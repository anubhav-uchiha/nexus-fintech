import {
  BadRequestException,
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

  requestHash: string;
}

interface CompleteInput {
  recordId: string;

  lockToken: string;

  response: unknown;

  providerStatusCode?: string;

  providerMerchantRefId?: string;

  providerTxnRefId?: string;
}

@Injectable()
export class VimopayIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /*
   * Financial request ka safe fingerprint.
   *
   * Raw value database mein nahi jayegi.
   * Sirf SHA-256 digest store hoga.
   */
  createRequestHash(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  async begin(input: BeginInput) {
    const lockToken = randomUUID();
    /*
     * =====================================================
     * UNSETTLED FINANCIAL INTENT CHECK
     * =====================================================
     *
     * Same financial intent:
     *
     * PROCESSING
     * PENDING
     * UNKNOWN
     *
     * state mein hai to NEW Idempotency-Key
     * se bhi provider dobara hit nahi hoga.
     */

    const unsettled = await this.prisma.aepsTransactionIdempotency.findFirst({
      where: {
        identityId: input.identityId,

        profileId: input.profileId,

        provider: AepsProvider.VIMOPAY,

        transactionType: input.transactionType,

        requestHash: input.requestHash,

        /*
         * Current same key ko yahan
         * handle nahi karenge.
         *
         * Existing upsert logic usko
         * niche handle karegi.
         */
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
          });

        case AepsIdempotencyStatus.PENDING:
          throw new ConflictException({
            message: 'A previous matching transaction is still pending',

            code: 'PREVIOUS_TRANSACTION_PENDING',
          });

        case AepsIdempotencyStatus.UNKNOWN:
          throw new ConflictException({
            message:
              'A previous matching transaction has an uncertain status and must be reconciled before retry',

            code: 'PREVIOUS_TRANSACTION_UNKNOWN',
          });
      }
    }
    const record = await this.prisma.aepsTransactionIdempotency.upsert({
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

        lockToken,

        status: AepsIdempotencyStatus.PROCESSING,
      },

      /*
       * Existing request ko modify
       * nahi karna.
       */
      update: {},
    });

    /*
     * Same key kisi different financial
     * request ke liye reuse hui.
     */
    if (record.requestHash !== input.requestHash) {
      throw new BadRequestException({
        message:
          'Idempotency-Key has already been used for a different request',

        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    }

    /*
     * Ye request row humne hi create ki.
     */
    if (record.lockToken === lockToken) {
      return {
        shouldExecute: true as const,

        recordId: record.id,

        lockToken,
      };
    }

    /*
     * Previous provider response available hai.
     *
     * Provider ko dobara hit nahi karenge.
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

      return {
        shouldExecute: false as const,

        response: record.response,
      };
    }

    /*
     * First request abhi chal rahi hai.
     */
    if (record.status === AepsIdempotencyStatus.PROCESSING) {
      throw new ConflictException({
        message: 'This transaction request is already being processed',

        code: 'TRANSACTION_IN_PROGRESS',
      });
    }

    /*
     * Provider timeout / uncertain state.
     *
     * Automatically retry nahi karenge,
     * warna duplicate financial transaction
     * ho sakti hai.
     */
    throw new ConflictException({
      message:
        'Transaction status is uncertain and must be reconciled before retry',

      code: 'TRANSACTION_STATUS_UNKNOWN',
    });
  }

  async complete(input: CompleteInput) {
    const providerStatus = input.providerStatusCode ?? '';

    let status: AepsIdempotencyStatus;

    switch (providerStatus) {
      case '000':
        status = AepsIdempotencyStatus.SUCCESS;

        break;

      case '001':
      case '003':
        status = AepsIdempotencyStatus.FAILED;

        break;

      case '002':
        status = AepsIdempotencyStatus.PENDING;

        break;

      default:
        status = AepsIdempotencyStatus.UNKNOWN;
    }

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

        providerStatusCode: providerStatus,

        response: input.response as object,

        completedAt: new Date(),

        /*
         * Request execution complete.
         */
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
   * Provider ko call karne se pehle local
   * validation fail ho gayi.
   *
   * Request provider tak gayi hi nahi,
   * so idempotency reservation release
   * kar sakte hain.
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
   * Provider call start ho chuki thi,
   * lekin timeout/network error aa gaya.
   *
   * Is situation mein automatic retry
   * dangerous hai.
   */
  async markUnknown(recordId: string, lockToken: string) {
    await this.prisma.aepsTransactionIdempotency.updateMany({
      where: {
        id: recordId,

        lockToken,

        status: AepsIdempotencyStatus.PROCESSING,
      },

      data: {
        status: AepsIdempotencyStatus.UNKNOWN,

        lockToken: null,
      },
    });
  }
}
