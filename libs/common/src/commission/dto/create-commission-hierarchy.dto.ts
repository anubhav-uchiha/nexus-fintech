import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCommissionHierarchyDto {
  @IsString()
  parentUserId!: string;

  @IsString()
  parentRole!: string;

  @IsString()
  childUserId!: string;

  @IsString()
  childRole!: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
