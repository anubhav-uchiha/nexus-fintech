import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VimopayMerchantOtpDto {
  @IsString()
  @IsNotEmpty()
  merchantId!: string;

  @IsString()
  @IsNotEmpty()
  merchantRefId!: string;
}

export class VimopayValidateMerchantOtpDto extends VimopayMerchantOtpDto {
  @IsString()
  @Matches(/^\d+$/)
  otp!: string;
}
