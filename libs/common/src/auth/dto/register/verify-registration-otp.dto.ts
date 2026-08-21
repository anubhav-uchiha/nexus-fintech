import { ApiProperty } from '@nestjs/swagger';
import { IsMobilePhone, IsString, Length, Matches } from 'class-validator';

export class VerifyRegistrationOtpDto {
  @ApiProperty()
  @IsString()
  draftId!: string;

  @ApiProperty()
  @IsMobilePhone('en-IN')
  phoneNumber!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits',
  })
  otp!: string;
}
