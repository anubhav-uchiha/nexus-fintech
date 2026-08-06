import { DocumentType } from 'apps/kyc-service/generated/kyc-prisma/enums';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @IsUUID()
  identityId!: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}
