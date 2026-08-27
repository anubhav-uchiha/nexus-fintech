import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VimopayCashWithdrawalOtpRequestDto {
  @IsString()
  @Matches(/^\d{12}$/)
  aadhaarNumber!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  custMobileNumber?: string;

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
  appPlatform!: string;

  @IsString()
  @IsNotEmpty()
  appVersion!: string;
}
