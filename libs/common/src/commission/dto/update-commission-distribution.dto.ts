import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { CommissionDistributionType } from './create-commission-distribution.dto';

export class UpdateCommissionDistributionDto {
  @IsOptional()
  @IsString()
  recipientRole?: string;

  @IsOptional()
  @IsEnum(CommissionDistributionType)
  distributionType?: CommissionDistributionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distributionValue?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
