import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoleDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/\s+/g, '_')
      : value,
  )
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'Role name must contain only uppercase letters, numbers and underscores',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Prefix must contain only uppercase letters and numbers',
  })
  prefix!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startingLoginIdNumber?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
