import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VimopayBalanceEnquiryDto {
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
  @Matches(/^\d+$/)
  mobileNumber!: string;

  @IsString()
  @Matches(/^\d+$/)
  bankIIN!: string;

  @IsString()
  @IsNotEmpty()
  ipAddress!: string;

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

  @IsOptional()
  @IsString()
  udf1?: string;

  @IsOptional()
  @IsString()
  udf2?: string;

  @IsOptional()
  @IsString()
  udf3?: string;

  /**
   * CW/AP > 5000 ke OTP flow mein actual txnRefId jayega.
   * BE ke liye abhi empty rahega.
   */
  @IsOptional()
  @IsString()
  cwAuthTxnId?: string;
}
