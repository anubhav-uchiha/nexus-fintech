import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  refreshToken!: string;
}
