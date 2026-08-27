import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VimopayBalanceEnquiryRequestDto {
  /*
   * Customer Aadhaar.
   */
  @IsString()
  @Matches(/^\d{12}$/, {
    message: 'aadhaarNumber must be exactly 12 digits',
  })
  aadhaarNumber!: string;

  /*
   * Customer mobile number.
   */
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'mobileNumber must be exactly 10 digits',
  })
  mobileNumber!: string;

  /*
   * Selected bank IIN from
   * VimoPay Bank IIN API.
   */
  @IsString()
  @IsNotEmpty()
  bankIIN!: string;

  /*
   * Current transaction location.
   */
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;

  /*
   * RD device type.
   */
  @IsString()
  @IsNotEmpty()
  deviceType!: string;

  /*
   * Fresh biometric PID XML.
   *
   * Isko DB mein save nahi karenge.
   */
  @IsString()
  @IsNotEmpty()
  pidData!: string;

  @IsOptional()
  @IsString()
  udf1?: string;

  @IsOptional()
  @IsString()
  udf2?: string;

  @IsOptional()
  @IsString()
  udf3?: string;
}
