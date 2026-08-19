import { IsUUID } from 'class-validator';
import { UpdateRoleStatusDto } from './update-role-status.dto';

export class UpdateRoleStatusPayloadDto extends UpdateRoleStatusDto {
  @IsUUID()
  id!: string;
}
