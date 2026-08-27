import { Transform } from 'class-transformer';

import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class VimopayRegisterDto {
  @IsUUID()
  bankAccountId!: string;

  @IsUUID()
  kycProfileId!: string;

  /**
   * VimoPay Bank List API ka code.
   * Example: 013
   */
  @IsString()
  @Matches(/^\d+$/)
  vimopayBankCode!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @Matches(/^\d{2}-\d{2}-\d{4}$/)
  dob!: string;

  @IsEmail()
  emailId!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  merchantPhoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  merchantAddress1!: string;

  @IsOptional()
  @IsString()
  merchantAddress2?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  merchantState!: string;

  @IsString()
  @IsNotEmpty()
  merchantDistrict!: string;

  @IsString()
  @IsIn(['M', 'F', 'O'])
  gender!: 'M' | 'F' | 'O';

  @IsString()
  @Matches(/^\d{6}$/)
  merchantPinCode!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  merchantPan!: string;

  @IsString()
  @Matches(/^\d{12}$/)
  aadhaarNumber!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  shopPan!: string;

  @IsString()
  @IsNotEmpty()
  shopAddress!: string;

  @IsString()
  @IsNotEmpty()
  shopDistrict!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  shopState!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  shopPincode!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  shopLat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  shopLong!: string;
}
