import { IsUUID } from 'class-validator';

export class PermissionIdDto {
  @IsUUID()
  id!: string;
}
