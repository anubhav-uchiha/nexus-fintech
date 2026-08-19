import { IsUUID } from 'class-validator';
import { UpdateRoleRegisterPermissionStatusDto } from './update-role-register-permission-status.dto';

export class UpdateRoleRegisterPermissionStatusPayloadDto extends UpdateRoleRegisterPermissionStatusDto {
  @IsUUID()
  registrarRoleId!: string;

  @IsUUID()
  targetRoleId!: string;
}
