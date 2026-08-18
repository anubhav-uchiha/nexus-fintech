import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum TransferWalletType {
  MAIN = 'MAIN',
  AEPS = 'AEPS',
  PROFIT = 'PROFIT',
}

export class TransferMoneyDto {
  @IsUUID()
  @IsNotEmpty()
  senderUserId!: string;

  @IsUUID()
  @IsNotEmpty()
  receiverUserId!: string;

  @IsEnum(TransferWalletType)
  walletType!: TransferWalletType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
