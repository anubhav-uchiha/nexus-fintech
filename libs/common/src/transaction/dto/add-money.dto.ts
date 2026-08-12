import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AddMoneyDto {
  @IsUUID()
  userId!: string;

  @IsString()
  walletType!: 'MAIN' | 'AEPS' | 'PROFIT';

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsString()
  idempotencyKey!: string;
}
