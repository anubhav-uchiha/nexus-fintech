import { IsUUID } from 'class-validator';

export class AssignPackagePermissionDto {
  @IsUUID()
  permissionId!: string;
}
