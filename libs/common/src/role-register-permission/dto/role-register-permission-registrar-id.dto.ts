import { IsUUID } from 'class-validator';

export class RoleRegisterPermissionRegistrarIdDto {
  @IsUUID()
  registrarRoleId!: string;
}
