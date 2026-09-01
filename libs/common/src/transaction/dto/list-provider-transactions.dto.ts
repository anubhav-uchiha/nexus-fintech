export interface ListProviderTransactionsDto {
  userId: string;

  provider?: string;

  serviceType?: string;

  operation?: string;

  status?:
    | 'INITIATED'
    | 'PROCESSING'
    | 'SUCCESS'
    | 'FAILED'
    | 'PENDING'
    | 'UNKNOWN'
    | 'REVERSED';

  page?: number;

  limit?: number;
}
