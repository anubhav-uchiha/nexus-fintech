import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { CreateKycDto } from '@nexus/common/kyc/dto/create-kyc.dto';
import { UploadDocumentDto } from '@nexus/common/kyc/dto/upload-document.dto';
import { KYC_PATTERNS } from '@nexus/common/kyc/kyc.patterns';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KycGatewayService implements OnModuleInit {
  constructor(
    @Inject('KYC_SERVICE')
    private readonly client: ClientKafka,
  ) {}
  async onModuleInit() {
    this.client.subscribeToResponseOf(KYC_PATTERNS.CREATE_KYC);
    this.client.subscribeToResponseOf(KYC_PATTERNS.GET_MY_KYC);
    this.client.subscribeToResponseOf(KYC_PATTERNS.UPLOAD_DOCUMENT);
    this.client.subscribeToResponseOf(KYC_PATTERNS.GET_DOCUMENTS);
    await this.client.connect();
  }

  async create(dto: CreateKycDto) {
    console.log('STEP 2 SERVICE');
    return await firstValueFrom(this.client.send(KYC_PATTERNS.CREATE_KYC, dto));
  }

  async getMyKyc(identityId: string) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.GET_MY_KYC, identityId),
    );
  }

  async uploadDocument(dto: UploadDocumentDto, file: Express.Multer.File) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.UPLOAD_DOCUMENT, {
        ...dto,
        originalFileName: file.originalname,
        storedFileName: file.filename,
        fileUrl: `/upload/kyc/${file.filename}`,
        mimeType: file.mimetype,
        fileSize: file.size,
      }),
    );
  }

  async getDocuments(identityId: string, page: number, limit: number) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.GET_DOCUMENTS, {
        identityId,
        page,
        limit,
      }),
    );
  }
}
