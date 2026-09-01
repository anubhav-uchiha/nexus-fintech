export interface PrepareAepsCashDepositDto {
  userId: string;

  providerTransactionIdempotencyKey: string;

  merchantProfileId: string;

  providerMerchantId: string;

  amount: number;

  bankIIN: string;

  aadhaarLast4: string;
}

export interface ConfirmAepsCashDepositDto {
  userId: string;

  providerTransactionReference: string;
}

export interface CompensateAepsCashDepositDto {
  userId: string;

  providerTransactionReference: string;

  amount: number;
}
