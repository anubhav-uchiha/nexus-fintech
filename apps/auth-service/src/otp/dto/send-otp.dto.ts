import { OtpPurpose, OtpType } from '../../../generated/prisma/enums';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsPhoneNumber,
  ValidateIf,
} from 'class-validator';

export class SendOtpDto {
  @IsEnum(OtpType)
  type!: OtpType;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ValidateIf((o) => o.type === OtpType.PHONE)
  @IsNotEmpty()
  @IsPhoneNumber('IN')
  phoneNumber?: string;

  @ValidateIf((o) => o.type === OtpType.PHONE)
  @IsNotEmpty()
  @IsEmail()
  email?: string;
}
