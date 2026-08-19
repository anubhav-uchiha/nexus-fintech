import { IsUUID } from 'class-validator';
import { UpdatePackageStatusDto } from './update-package-status.dto';

export class UpdatePackageStatusPayloadDto extends UpdatePackageStatusDto {
  @IsUUID()
  id!: string;
}
