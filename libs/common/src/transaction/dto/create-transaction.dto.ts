import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum TransactionWalletType {
  MAIN = 'MAIN',
  AEPS = 'AEPS',
  PROFIT = 'PROFIT',
}

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export class CreateTransactionDto {
  @IsUUID()
  userId!: string;

  @IsEnum(TransactionWalletType)
  walletType!: TransactionWalletType;

  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
