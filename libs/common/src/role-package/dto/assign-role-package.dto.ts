import { IsUUID } from 'class-validator';

export class AssignRolePackageDto {
  @IsUUID()
  packageId!: string;
}
