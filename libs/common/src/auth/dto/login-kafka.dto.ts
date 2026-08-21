import { IsOptional, IsString, MaxLength } from 'class-validator';

import { LoginDto } from './login.dto';

export class LoginKafkaDto extends LoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  device?: string;
}
