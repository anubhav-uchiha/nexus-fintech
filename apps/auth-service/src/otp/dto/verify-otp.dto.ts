import { OtpType } from '../../../generated/prisma/enums';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsPhoneNumber,
  Length,
  ValidateIf,
} from 'class-validator';

export class VerifyOtpDto {
  @IsEnum(OtpType)
  type!: OtpType;

  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;

  @ValidateIf((o) => o.type === OtpType.PHONE)
  @IsNotEmpty()
  @IsPhoneNumber('IN')
  phoneNumber?: string;

  @ValidateIf((o) => o.type === OtpType.EMAIL)
  @IsNotEmpty()
  @IsEmail()
  email?: string;
}
