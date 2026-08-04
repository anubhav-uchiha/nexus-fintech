import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  draftId!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  newPassword!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;
}
