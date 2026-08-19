import { IsBoolean } from 'class-validator';

export class UpdatePermissionStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
