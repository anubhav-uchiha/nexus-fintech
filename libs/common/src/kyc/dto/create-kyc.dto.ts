import { IsUUID } from 'class-validator';

export class CreateKycDto {
  @IsUUID()
  identityId!: string;
}
