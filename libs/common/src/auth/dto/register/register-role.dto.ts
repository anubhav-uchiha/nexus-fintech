import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum RegisterRole {
  RETAILER = 'RETAILER',
  DISTRIBUTOR = 'DISTRIBUTOR',
}

export class RegisterRoleDto {
  @ApiProperty({
    enum: RegisterRole,
  })
  @IsEnum(RegisterRole)
  role!: RegisterRole;
}
