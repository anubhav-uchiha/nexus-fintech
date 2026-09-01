import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Type } from 'class-transformer';

export class ProviderTransactionQueryDto {
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
  @IsIn([
    'INITIATED',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
    'PENDING',
    'UNKNOWN',
    'REVERSED',
  ])
  status?: string;

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
