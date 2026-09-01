export interface CreditAepsCommissionDto {
  userId: string;

  commissionId: string;

  commissionReference: string;

  providerTransactionReference: string;

  amount: number;

  serviceType: string;
}
