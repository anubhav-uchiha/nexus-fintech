import { ApiProperty } from '@nestjs/swagger';
import { LoginMethod } from 'apps/auth-service/generated/prisma/enums';
import { IsEnum } from 'class-validator';

export class ChangeLoginMethodDto {
  @ApiProperty({
    enum: LoginMethod,
  })
  @IsEnum(LoginMethod)
  preferredLoginMethod!: LoginMethod;
}
