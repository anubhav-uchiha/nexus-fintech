import { IsString, Length, Matches } from 'class-validator';

export class IdentityOnboardingVerifyPhoneDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, {
    message: 'otp must contain exactly 6 digits',
  })
  otp!: string;
}
