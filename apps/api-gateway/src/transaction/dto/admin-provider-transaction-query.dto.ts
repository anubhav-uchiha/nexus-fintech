import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

export class AdminProviderTransactionQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

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
  @IsIn([
    'NOT_REQUIRED',
    'PENDING',
    'RESERVED',
    'SETTLED',
    'COMPENSATED',
    'FAILED',
    'UNKNOWN',
  ])
  settlementStatus?: string;

  @IsOptional()
  @IsIn([
    'NOT_REQUIRED',
    'WAITING_PROVIDER_INCOME',
    'PENDING',
    'SETTLED',
    'FAILED',
    'REVERSED',
  ])
  commissionStatus?: string;

  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;

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
