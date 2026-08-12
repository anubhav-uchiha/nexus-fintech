
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentType } from '../enums/document-type.enum';

export class UploadDocumentDto {
  @IsUUID()
  identityId!: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}
