import { IsUUID } from 'class-validator';
import { UpdatePermissionDto } from './update-permission.dto';

export class UpdatePermissionPayloadDto extends UpdatePermissionDto {
  @IsUUID()
  id!: string;
}
