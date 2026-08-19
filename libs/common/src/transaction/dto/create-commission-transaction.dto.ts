import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateCommissionTransactionDto {
  @IsUUID()
  userId!: string;

  @IsString()
  walletType!: 'MAIN' | 'AEPS' | 'PROFIT';

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  serviceType!: string;

  @IsString()
  description!: string;

  @IsString()
  commissionId!: string;

  @IsString()
  originalTransactionId!: string;

  @IsString()
  idempotencyKey!: string;
}
