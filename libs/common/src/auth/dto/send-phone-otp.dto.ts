import { IsPhoneNumber } from 'class-validator';

export class SendPhoneOtpDto {
  @IsPhoneNumber('IN')
  phoneNumber!: string;
}
