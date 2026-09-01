import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Type } from 'class-transformer';

export class ProviderReconciliationQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsIn(['BE', 'MS', 'CW', 'AP', 'CD'])
  operation?: string;

  @IsOptional()
  @IsIn(['PENDING', 'UNKNOWN'])
  status?: 'PENDING' | 'UNKNOWN';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ResolveProviderTransactionRequestDto {
  @IsIn(['SUCCESS', 'FAILED'])
  resolution!: 'SUCCESS' | 'FAILED';

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  providerTxnRefId?: string;

  @IsOptional()
  @IsString()
  rrn?: string;

  @IsOptional()
  @IsString()
  npciCode?: string;

  @IsOptional()
  @IsString()
  npciMessage?: string;
}
