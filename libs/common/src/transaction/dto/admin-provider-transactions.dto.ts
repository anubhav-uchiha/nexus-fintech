export interface AdminListProviderTransactionsDto {
  userId?: string;

  provider?: string;

  serviceType?: string;

  operation?: 'BE' | 'MS' | 'CW' | 'AP' | 'CD';

  status?:
    | 'INITIATED'
    | 'PROCESSING'
    | 'SUCCESS'
    | 'FAILED'
    | 'PENDING'
    | 'UNKNOWN'
    | 'REVERSED';

  settlementStatus?:
    | 'NOT_REQUIRED'
    | 'PENDING'
    | 'RESERVED'
    | 'SETTLED'
    | 'COMPENSATED'
    | 'FAILED'
    | 'UNKNOWN';

  commissionStatus?:
    | 'NOT_REQUIRED'
    | 'WAITING_PROVIDER_INCOME'
    | 'PENDING'
    | 'SETTLED'
    | 'FAILED'
    | 'REVERSED';

  fromDate?: string;

  toDate?: string;

  page?: number;

  limit?: number;
}

export interface ListProviderReversalsDto {
  status?: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';

  userId?: string;

  provider?: string;

  operation?: string;

  page?: number;

  limit?: number;
}
