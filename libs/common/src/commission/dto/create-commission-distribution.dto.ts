import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum CommissionDistributionType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export class CreateCommissionDistributionDto {
  @IsString()
  @IsNotEmpty()
  commissionRuleId!: string;

  @IsString()
  @IsNotEmpty()
  recipientRole!: string;

  @IsEnum(CommissionDistributionType)
  distributionType!: CommissionDistributionType;

  @IsNumber()
  @Min(0)
  distributionValue!: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
