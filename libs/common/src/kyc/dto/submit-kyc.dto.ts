import { IsUUID } from 'class-validator';

export class SubmitKycDto {
  @IsUUID()
  identityId!: string;
}
