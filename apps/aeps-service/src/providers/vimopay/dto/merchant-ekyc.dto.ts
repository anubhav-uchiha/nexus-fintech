import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class VimopayMerchantEkycDto {
  @IsString()
  @IsNotEmpty()
  merchantId!: string;

  @IsString()
  @IsNotEmpty()
  merchantRefId!: string;

  @IsString()
  @IsNotEmpty()
  pidData!: string;
}