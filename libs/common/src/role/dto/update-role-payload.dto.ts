import { IsUUID } from 'class-validator';
import { UpdateRoleDto } from './update-role.dto';

export class UpdateRolePayloadDto extends UpdateRoleDto {
  @IsUUID()
  id!: string;
}
