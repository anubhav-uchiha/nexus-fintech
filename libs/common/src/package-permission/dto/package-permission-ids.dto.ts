import { IsUUID } from 'class-validator';

export class PackagePermissionIdsDto {
  @IsUUID()
  packageId!: string;

  @IsUUID()
  permissionId!: string;
}
