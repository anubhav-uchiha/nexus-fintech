export type ProviderCommissionState =
  | 'NOT_REQUIRED'
  | 'WAITING_PROVIDER_INCOME'
  | 'PENDING'
  | 'SETTLED'
  | 'FAILED'
  | 'REVERSED';

export interface UpdateProviderCommissionStateDto {
  referenceId: string;

  status: ProviderCommissionState;

  commissionReferenceId?: string;

  commissionWalletTransactionReference?: string;

  commissionAmount?: number;

  failureReason?: string;

  /*
   * Provider income audit.
   */
  providerIncomeSource?: string;

  providerIncomeExternalReference?: string;

  providerIncomeReconciledBy?: string;
}
