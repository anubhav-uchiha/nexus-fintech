import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class VimopayAadhaarPayRequestDto {
  @IsString()
  @Matches(/^\d{12}$/)
  aadhaarNumber!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
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
  @IsUUID()
  authRequestId?: string;

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