import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VimopayCashDepositRequestDto {
  @IsString()
  @Matches(/^\d{12}$/, {
    message: 'aadhaarNumber must be exactly 12 digits',
  })
  aadhaarNumber!: string;

  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'mobileNumber must be exactly 10 digits',
  })
  mobileNumber!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a valid amount',
  })
  amount!: string;

  @IsString()
  @IsNotEmpty()
  bankIIN!: string;

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
  udf1?: string;

  @IsOptional()
  @IsString()
  udf2?: string;

  @IsOptional()
  @IsString()
  udf3?: string;
}
