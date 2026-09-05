import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProviderCommissionDto {
  @IsString()
  @IsNotEmpty()
  providerTransactionId!: string;

  @IsString()
  @IsNotEmpty()
  providerTransactionReference!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;

  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsNumber()
  @Min(0.01)
  transactionAmount!: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  providerCommissionAmount?: number;

  @IsOptional()
  @IsIn(['RULE', 'PROVIDER'])
  commissionAmountSource?: 'RULE' | 'PROVIDER';

  @IsOptional()
  @IsString()
  providerIncomeSource?:
    'DUMMY_VIMOPAY_2_PERCENT' | 'VIMOPAY_WALLET' | 'VIMOPAY_MS';
}
