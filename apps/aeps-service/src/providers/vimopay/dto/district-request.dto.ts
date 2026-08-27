import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class VimopayDistrictRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  stateCode!: string;
}
