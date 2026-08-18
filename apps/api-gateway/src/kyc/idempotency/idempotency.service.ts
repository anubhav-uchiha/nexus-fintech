import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { IdempotencyRepository } from './idempotency.repository';
import { createHash } from 'crypto';
import { IdempotencyStatus } from 'apps/kyc-service/generated/kyc-prisma/enums';

import {
  ExecuteIdempotentOptions,
  IdempotencyResult,
} from './idempotency.types';

@Injectable()
export class IdempotencyService {
  private readonly defaultTtlSeconds = 24 * 60 * 60;

  constructor(private readonly idempotencyRepository: IdempotencyRepository) {}

  private generateRequestHash(payload: unknown): string {
    const normalizedPayload = this.stableStringify(payload);

    return createHash('sha256').update(normalizedPayload).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      const object = value as Record<string, unknown>;

      const sortedKeys = Object.keys(object).sort();

      return `{${sortedKeys
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(object[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private getExpiresAt(ttlSeconds: number): Date {
    return new Date(Date.now() + ttlSeconds * 1000);
  }

  private validateIdempotencyKey(idempotencyKey?: string): string {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const key = idempotencyKey.trim();

    if (key.length > 255) {
      throw new BadRequestException(
        'Idempotency-Key must not exceed 255 characters',
      );
    }

    return key;
  }

  private handleExistingRecord(
    record: {
      requestHash: string;
      status: IdempotencyStatus;
      response: unknown;
      statusCode: number | null;
      expiresAt: Date;
    },
    requestHash: string,
  ): IdempotencyResult {
    if (record.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency-Key has already been used with a different request',
      );
    }

    if (record.status === IdempotencyStatus.PROCESSING) {
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed',
      );
    }

    if (record.status === IdempotencyStatus.COMPLETED) {
      return {
        status: IdempotencyStatus.COMPLETED,
        response: record.response,
        statusCode: record.statusCode,
      };
    }

    return {
      status: IdempotencyStatus.FAILED,
      response: record.response,
      statusCode: record.statusCode,
    };
  }

  private extractErrorResponse(error: unknown): {
    statusCode: number;
    response: unknown;
  } {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      return {
        statusCode: error.getStatus(),
        response,
      };
    }

    if (error instanceof ConflictException) {
      const response = error.getResponse();

      return {
        statusCode: error.getStatus(),
        response,
      };
    }

    if (
      error &&
      typeof error === 'object' &&
      'getStatus' in error &&
      typeof (error as { getStatus?: unknown }).getStatus === 'function'
    ) {
      const httpError = error as {
        getStatus: () => number;
        getResponse: () => unknown;
      };

      return {
        statusCode: httpError.getStatus(),
        response: httpError.getResponse(),
      };
    }

    if (error instanceof Error) {
      return {
        statusCode: 500,
        response: {
          message: error.message,
        },
      };
    }

    return {
      statusCode: 500,
      response: {
        message: 'Internal server error',
      },
    };
  }

  private async handleFailure(
    idempotencyKey: string,
    identityId: string,
    operation: string,
    error: unknown,
  ): Promise<void> {
    const { statusCode, response } = this.extractErrorResponse(error);

    try {
      await this.idempotencyRepository.markFailed(
        idempotencyKey,
        identityId,
        operation,
        response,
        statusCode,
      );
    } catch (updateError) {
      console.error(
        'Failed to mark idempotency record as FAILED:',
        updateError,
      );
    }
  }

  async execute<T>(
    options: ExecuteIdempotentOptions<T>,
  ): Promise<T | IdempotencyResult> {
    const idempotencyKey = this.validateIdempotencyKey(options.idempotencyKey);

    const requestHash = this.generateRequestHash(options.payload);

    const existing = await this.idempotencyRepository.find(
      options.identityId,
      options.operation,
      idempotencyKey,
    );

    if (existing) {
      return this.handleExistingRecord(existing, requestHash);
    }

    const ttlSeconds = options.ttlSeconds ?? this.defaultTtlSeconds;

    const expiresAt = this.getExpiresAt(ttlSeconds);

    let processingRecord;

    try {
      processingRecord = await this.idempotencyRepository.createProcessing({
        identityId: options.identityId,
        operation: options.operation,
        idempotencyKey,
        requestHash,
        expiresAt,
      });
    } catch (error) {
      const concurrentRecord = await this.idempotencyRepository.find(
        options.identityId,
        options.operation,
        idempotencyKey,
      );

      if (concurrentRecord) {
        return this.handleExistingRecord(concurrentRecord, requestHash);
      }

      throw error;
    }

    try {
      const result = await options.handler();

      await this.idempotencyRepository.markCompleted(
        processingRecord.idempotencyKey,
        processingRecord.identityId,
        processingRecord.operation,
        result,
        200,
      );

      return result;
    } catch (error) {
      await this.handleFailure(
        processingRecord.idempotencyKey,
        processingRecord.identityId,
        processingRecord.operation,
        error,
      );

      throw error;
    }
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.idempotencyRepository.deleteExpired();

    return result.count;
  }
}
