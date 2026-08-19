import { IsBoolean } from 'class-validator';

export class UpdatePackageStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
