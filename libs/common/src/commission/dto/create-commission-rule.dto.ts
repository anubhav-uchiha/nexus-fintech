import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum CommissionType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export class CreateCommissionRuleDto {
  @IsString()
  serviceType!: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsString()
  role!: string;

  @IsEnum(CommissionType)
  commissionType!: CommissionType;

  @IsNumber()
  @Min(0)
  commissionValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
