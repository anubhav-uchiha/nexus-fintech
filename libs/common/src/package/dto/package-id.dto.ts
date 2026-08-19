import { IsUUID } from 'class-validator';

export class PackageIdDto {
  @IsUUID()
  id!: string;
}
