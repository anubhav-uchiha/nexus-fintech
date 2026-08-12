import { Injectable } from '@nestjs/common';
import { IdempotencyStatus } from 'apps/kyc-service/generated/kyc-prisma/enums';
import { Prisma } from 'apps/kyc-service/generated/kyc-prisma/client';
import { PrismaService } from 'apps/kyc-service/src/database/prisma.service';

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(identityId: string, operation: string, idempotencyKey: string) {
    return this.prisma.idempotencyRecord.findUnique({
      where: {
        identityId_operation_idempotencyKey: {
          identityId,
          operation,
          idempotencyKey,
        },
      },
    });
  }
  async createProcessing(data: {
    identityId: string;
    operation: string;
    idempotencyKey: string;
    requestHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.idempotencyRecord.create({
      data: {
        identityId: data.identityId,
        operation: data.operation,
        idempotencyKey: data.idempotencyKey,
        requestHash: data.requestHash,
        status: IdempotencyStatus.PROCESSING,
        expiresAt: data.expiresAt,
      },
    });
  }
  async markCompleted(
    idempotencyKey: string,
    identityId: string,
    operation: string,
    response: unknown,
    statusCode: number,
  ) {
    return this.prisma.idempotencyRecord.update({
      where: {
        identityId_operation_idempotencyKey: {
          identityId,
          operation,
          idempotencyKey,
        },
      },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: response as Prisma.InputJsonValue,
        statusCode,
      },
    });
  }

  async markFailed(
    idempotencyKey: string,
    identityId: string,
    operation: string,
    response: unknown,
    statusCode: number,
  ) {
    return this.prisma.idempotencyRecord.update({
      where: {
        identityId_operation_idempotencyKey: {
          identityId,
          operation,
          idempotencyKey,
        },
      },
      data: {
        status: IdempotencyStatus.FAILED,
        response: response as Prisma.InputJsonValue,
        statusCode,
      },
    });
  }

  async deleteExpired() {
    return this.prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
