import { IsUUID } from 'class-validator';

export class PackagePermissionPackageIdDto {
  @IsUUID()
  packageId!: string;
}
