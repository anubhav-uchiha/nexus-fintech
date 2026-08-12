import { IsUUID } from 'class-validator';

export class UploadVideoDto {
  @IsUUID()
  identity!: string;
}
