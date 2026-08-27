import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VimopayCashWithdrawalDto {
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
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @IsString()
  @IsNotEmpty()
  ipAddress!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;

  @IsString()
  @IsNotEmpty()
  deviceType!: string;

  @IsString()
  @IsNotEmpty()
  pidData!: string;

  @IsOptional()
  @IsString()
  cwAuthTxnId?: string;

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
