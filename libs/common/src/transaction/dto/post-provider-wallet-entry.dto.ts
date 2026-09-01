export type ProviderWalletEntryAction = 'SETTLE' | 'RESERVE' | 'COMPENSATE';

export interface PostProviderWalletEntryDto {
  userId: string;

  providerTransactionReference: string;

  walletType: 'MAIN' | 'AEPS' | 'PROFIT';

  type: 'CREDIT' | 'DEBIT';

  amount: number;

  serviceType: string;

  description: string;

  idempotencyKey: string;

  action: ProviderWalletEntryAction;
  
  providerAmount?: number;
}
