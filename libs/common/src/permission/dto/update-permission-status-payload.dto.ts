import { IsUUID } from 'class-validator';
import { UpdatePermissionStatusDto } from './update-permission-status.dto';

export class UpdatePermissionStatusPayloadDto extends UpdatePermissionStatusDto {
  @IsUUID()
  id!: string;
}
