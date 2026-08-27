import {
  IsString,
  Matches,
} from 'class-validator';

export class VimopayVerifyOtpDto {
  @IsString()
  @Matches(/^\d+$/, {
    message: 'otp must contain only digits',
  })
  otp!: string;
}