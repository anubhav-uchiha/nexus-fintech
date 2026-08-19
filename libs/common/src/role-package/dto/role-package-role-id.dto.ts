import { IsUUID } from 'class-validator';

export class RolePackageRoleIdDto {
  @IsUUID()
  roleId!: string;
}
