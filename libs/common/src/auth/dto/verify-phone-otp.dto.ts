import { IsPhoneNumber, Length } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsPhoneNumber('IN')
  phoneNumber!: string;

  @Length(6, 6)
  otp!: string;
}
