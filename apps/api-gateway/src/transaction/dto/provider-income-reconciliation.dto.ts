import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { Type } from 'class-transformer';

export class ProviderIncomeReconciliationRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  providerIncomeAmount?: number;

  @IsOptional()
  @IsIn(['VIMOPAY_WALLET', 'VIMOPAY_MS'])
  incomeSource?: 'VIMOPAY_WALLET' | 'VIMOPAY_MS';

  @IsOptional()
  @IsString()
  externalReference?: string;
}
