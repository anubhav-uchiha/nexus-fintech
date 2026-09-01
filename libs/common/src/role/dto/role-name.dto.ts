import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class RoleNameDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_')
      : value,
  )
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'Role name must contain only uppercase letters, numbers and underscores',
  })
  name!: string;
}