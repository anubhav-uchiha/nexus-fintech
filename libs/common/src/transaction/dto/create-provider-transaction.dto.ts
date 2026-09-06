import { JsonObject } from '../types/json-value.type';

export interface CreateProviderTransactionDto {
  userId: string;

  serviceType: string;

  provider: string;

  operation: string;

  amount: number;

  idempotencyKey?: string;

  merchantProfileId?: string;

  providerMerchantId?: string;

  bankIIN?: string;

  aadhaarLast4?: string;

  metadata?: JsonObject;

  settlementRequired?: boolean;

  sourceRole?: string;
}
