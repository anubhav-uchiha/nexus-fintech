import { IsUUID } from 'class-validator';

export class ResolveRolePermissionsDto {
  @IsUUID()
  roleId!: string;
}
