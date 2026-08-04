import { ApiProperty } from '@nestjs/swagger';
import { IsMobilePhone, IsString, Length } from 'class-validator';

export class VerifyRegistrationOtpDto {
  @ApiProperty()
  @IsString()
  draftId!: string;

  @ApiProperty()
  @IsMobilePhone('en-IN')
  phoneNumber!: string;

  @ApiProperty()
  otp!: string;
}
