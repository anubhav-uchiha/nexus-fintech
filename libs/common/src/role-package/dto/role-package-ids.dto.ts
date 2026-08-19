import { IsUUID } from 'class-validator';

export class RolePackageIdsDto {
  @IsUUID()
  roleId!: string;

  @IsUUID()
  packageId!: string;
}
