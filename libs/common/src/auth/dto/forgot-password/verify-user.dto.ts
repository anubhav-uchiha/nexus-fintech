import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyForgotPasswordUserDto {
  @IsString()
  @IsNotEmpty()
  loginId!: string;

  @IsString()
  @Length(10, 10)
  panNumber!: string;

  @IsString()
  @Length(4, 4)
  aadharLast4!: string;
}
