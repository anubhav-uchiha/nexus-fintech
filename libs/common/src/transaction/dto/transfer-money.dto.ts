import {
  Equals,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export enum TransferWalletType {
  MAIN = 'MAIN',
  AEPS = 'AEPS',
  PROFIT = 'PROFIT',
}

export class PeerTransferRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  receiverLoginId!: string;

  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
export class PeerTransferCommandDto {
  @IsUUID()
  senderUserId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  receiverLoginId!: string;

  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}

export class TransferMoneyDto {
  @IsUUID()
  senderUserId!: string;

  @IsUUID()
  receiverUserId!: string;

  @IsString()
  @IsNotEmpty()
  senderLoginId!: string;

  @IsString()
  @IsNotEmpty()
  receiverLoginId!: string;

  @IsString()
  @IsNotEmpty()
  senderRole!: string;

  @IsString()
  @IsNotEmpty()
  receiverRole!: string;

  @Equals(TransferWalletType.MAIN)
  walletType!: TransferWalletType.MAIN;

  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
