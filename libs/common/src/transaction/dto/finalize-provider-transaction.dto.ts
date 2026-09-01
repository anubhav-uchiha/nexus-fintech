import { JsonObject } from '../types/json-value.type';

export type FinalProviderTransactionStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface FinalizeProviderTransactionDto {
  referenceId: string;

  status: FinalProviderTransactionStatus;

  providerMerchantRefId?: string;

  providerTxnRefId?: string;

  rrn?: string;

  npciCode?: string;

  npciMessage?: string;

  providerStatusCode?: string;

  providerStatusMessage?: string;

  metadata?: JsonObject;
}
