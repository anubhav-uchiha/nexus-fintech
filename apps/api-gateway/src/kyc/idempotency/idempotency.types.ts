import { IdempotencyStatus } from 'apps/kyc-service/generated/kyc-prisma/enums';

export interface IdempotencyRecordData {
  idempotencyKey: string;
  identityId: string;
  operation: string;
  requestHash: string;
  status: IdempotencyStatus;
  response?: unknown;
  statusCode?: number;
  expiresAt: Date;
}

export interface IdempotencyResult {
  status: IdempotencyStatus;
  response: unknown | null;
  statusCode: number | null;
}

export interface ExecuteIdempotentOptions<T> {
  identityId: string;
  operation: string;
  idempotencyKey?: string;
  payload: unknown;
  handler: () => Promise<T>;
  ttlSeconds?: number;
}
