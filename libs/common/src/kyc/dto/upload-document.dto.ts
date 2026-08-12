
import { DocumentType } from 'apps/kyc-service/generated/kyc-prisma/enums';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}
