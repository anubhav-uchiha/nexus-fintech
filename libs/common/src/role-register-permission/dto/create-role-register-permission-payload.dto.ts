import { IsUUID } from 'class-validator';
import { CreateRoleRegisterPermissionDto } from './create-role-register-permission.dto';

export class CreateRoleRegisterPermissionPayloadDto extends CreateRoleRegisterPermissionDto {
  @IsUUID()
  registrarRoleId!: string;
}
