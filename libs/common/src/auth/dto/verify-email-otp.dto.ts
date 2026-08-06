import { IsEmail, Length } from 'class-validator';

export class VerifyEmailOtpDto {
  @IsEmail()
  email!: string;
  @Length(6, 6)
  otp!: string;
}
