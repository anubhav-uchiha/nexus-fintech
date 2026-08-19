import { IsUUID } from 'class-validator';

export class RoleRegisterPermissionIdsDto {
  @IsUUID()
  registrarRoleId!: string;

  @IsUUID()
  targetRoleId!: string;
}
