import { IsBoolean } from 'class-validator';

export class UpdateRoleRegisterPermissionStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
