export interface RequestProviderTransactionReversalDto {
  referenceId: string;

  requestedBy: string;

  reason: string;

  idempotencyKey: string;
}