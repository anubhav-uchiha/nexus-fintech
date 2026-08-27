import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class VimopayAepsTransactionOtpDto {
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
  bankIIN!: string;

  /**
   * Cash Withdrawal = CWTFA
   * Aadhaar Pay      = APTFA
   */
  @IsString()
  @IsIn(['CWTFA', 'APTFA'])
  transactionType!: 'CWTFA' | 'APTFA';

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @IsString()
  @Matches(/^\d+$/)
  mobileNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d*$/)
  custMobileNumber?: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;

  @IsString()
  @IsNotEmpty()
  ipAddress!: string;

  @IsString()
  @IsNotEmpty()
  appPlatform!: string;

  @IsString()
  @IsNotEmpty()
  appVersion!: string;
}
