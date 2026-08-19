import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { CommissionType } from './create-commission-rule.dto';

export class UpdateCommissionRuleDto {
  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsString()
  operator?: string | null;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number | null;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
