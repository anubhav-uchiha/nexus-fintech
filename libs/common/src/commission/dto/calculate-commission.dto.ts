import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

// export enum CommissionWalletType {
//   MAIN = 'MAIN',
//   AEPS = 'AEPS',
//   PROFIT = 'PROFIT',
// }

export class CalculateCommissionDto {
  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  transactionReference?: string;

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

  // @IsEnum(CommissionWalletType)
  // walletType!: CommissionWalletType;

  @IsNumber()
  @Min(0.01)
  transactionAmount!: number;

  // @IsOptional()
  // @IsString()
  // externalReference?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
