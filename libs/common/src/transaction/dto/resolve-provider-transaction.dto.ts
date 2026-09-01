export interface ResolveProviderTransactionDto {
  referenceId: string;

  resolution: 'SUCCESS' | 'FAILED';
  // | 'REVERSED';

  resolvedBy: string;

  note?: string;

  providerTxnRefId?: string;

  rrn?: string;

  npciCode?: string;

  npciMessage?: string;
}
