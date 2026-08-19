import { IsUUID } from 'class-validator';

export class ResolveIdentityPermissionsDto {
  @IsUUID()
  identityId!: string;
}
