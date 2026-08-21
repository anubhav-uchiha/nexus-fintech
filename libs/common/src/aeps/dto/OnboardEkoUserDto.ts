import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class EkoResidenceAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  line!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  @IsString()
  @Matches(/^[1-9][0-9]{5}$/, {
    message: 'pincode must be a valid 6-digit Indian pincode',
  })
  pincode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;
}

export class OnboardEkoUserDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: 'pan_number must be a valid PAN number',
  })
  pan_number!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'mobile must be a valid 10-digit Indian mobile number',
  })
  mobile!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name!: string;

  /**
   * Eko expects residence_address as JSON.
   */
  @IsObject()
  @ValidateNested()
  @Type(() => EkoResidenceAddressDto)
  residence_address!: EkoResidenceAddressDto;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  shop_name!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dob must use YYYY-MM-DD format',
  })
  @IsDateString(
    {},
    {
      message: 'dob must be a valid date',
    },
  )
  dob!: string;
}
