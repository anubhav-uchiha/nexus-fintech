import {
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
}
