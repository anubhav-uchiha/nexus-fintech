export interface PrepareProviderWalletDebitDto {
  userId: string;

  provider: string;

  serviceType: string;

  operation: string;

  amount: number;

  idempotencyKey: string;

  merchantProfileId?: string;

  providerMerchantId?: string;

  bankIIN?: string;

  aadhaarLast4?: string;

  walletType: 'AEPS';

  walletServiceType: string;

  walletDescription: string;
}