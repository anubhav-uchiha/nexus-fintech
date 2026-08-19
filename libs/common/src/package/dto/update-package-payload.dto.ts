import { IsUUID } from 'class-validator';
import { UpdatePackageDto } from './update-package.dto';

export class UpdatePackagePayloadDto extends UpdatePackageDto {
  @IsUUID()
  id!: string;
}
