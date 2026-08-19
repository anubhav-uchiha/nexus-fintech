import { IsUUID } from 'class-validator';

export class RoleIdDto {
  @IsUUID()
  id!: string;
}
