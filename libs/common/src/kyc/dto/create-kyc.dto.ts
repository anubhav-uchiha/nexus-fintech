import { IsUUID } from 'class-validator';
import { identity } from 'rxjs';

export class CreateKycDto {
  @IsUUID()
  identityId!: string;
}
