export interface SettleAepsPrincipalDto {
  userId: string;

  providerTransactionReference: string;

  operation: 'CW' | 'AP';

  /*
   * Provider / customer-facing gross.
   */
  grossAmount: number;

  /*
   * AEPS wallet principal after
   * total commission deduction.
   */
  netAmount: number;
}
