import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateAadhaarDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  documentNumber?: string;
}
