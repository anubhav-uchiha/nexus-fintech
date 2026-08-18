import { IsNotEmpty, IsString } from 'class-validator';

export class UploadAadharDto {
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;
}
