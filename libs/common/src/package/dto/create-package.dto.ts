import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePackageDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/\s+/g, '_')
      : value,
  )
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'Package code must contain only uppercase letters, numbers and underscores',
  })
  code!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'number') {
      return value.toString();
    }

    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'Price must be a positive decimal value with a maximum of 2 decimal places',
  })
  price?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
