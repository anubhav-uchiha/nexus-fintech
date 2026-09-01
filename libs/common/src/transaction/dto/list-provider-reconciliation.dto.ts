export interface ListProviderReconciliationDto {
  provider?: string;

  serviceType?: string;

  operation?: string;

  status?: 'PENDING' | 'UNKNOWN';

  page?: number;

  limit?: number;
}
