import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VimopayTwoFactorAuthDto {
  @IsString()
  @IsNotEmpty()
  merchantId!: string;

  @IsString()
  @IsNotEmpty()
  merchantRefId!: string;

  @IsString()
  @Matches(/^\d{12}$/)
  aadhaarNumber!: string;

  @IsString()
  @IsNotEmpty()
  deviceType!: string;

  @IsString()
  @IsNotEmpty()
  pidData!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;
}
