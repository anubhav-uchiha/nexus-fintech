import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCommissionHierarchyDto {
  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
