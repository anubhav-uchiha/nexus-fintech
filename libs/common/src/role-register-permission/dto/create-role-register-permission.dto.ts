import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateRoleRegisterPermissionDto {
  @IsUUID()
  targetRoleId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
