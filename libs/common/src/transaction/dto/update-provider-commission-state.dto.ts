export type ProviderCommissionState =
  'NOT_REQUIRED' | 'PENDING' | 'SETTLED' | 'FAILED';

export interface UpdateProviderCommissionStateDto {
  referenceId: string;

  status: ProviderCommissionState;

  commissionReferenceId?: string;

  commissionWalletTransactionReference?: string;

  commissionAmount?: number;

  failureReason?: string;
}
