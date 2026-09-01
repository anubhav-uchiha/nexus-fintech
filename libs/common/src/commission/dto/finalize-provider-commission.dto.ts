import { IsNotEmpty, IsString } from 'class-validator';

export class FinalizeProviderCommissionDto {
  @IsString()
  @IsNotEmpty()
  commissionReference!: string;

  @IsString()
  @IsNotEmpty()
  walletTransactionId!: string;

  @IsString()
  @IsNotEmpty()
  walletTransactionReference!: string;
}
