import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { CreateKycDto } from '@nexus/common/kyc/dto/create-kyc.dto';
import { UpdateAadhaarDto } from '@nexus/common/kyc/dto/update-aadhaar.dto';
import { UploadAadharDto } from '@nexus/common/kyc/dto/upload-aadhar-dto';
import { UploadDocumentDto } from '@nexus/common/kyc/dto/upload-document.dto';
import { UploadVideoDto } from '@nexus/common/kyc/dto/upload-video.dto';

import { KYC_PATTERNS } from '@nexus/common/kyc/kyc.patterns';

interface S3FileMetadata {
  originalFileName: string;
  storedFileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

@Injectable()
export class KycGatewayService implements OnModuleInit {
  constructor(
    @Inject('KYC_SERVICE')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(KYC_PATTERNS.CREATE_KYC);

    this.client.subscribeToResponseOf(KYC_PATTERNS.SUBMIT_KYC);

    this.client.subscribeToResponseOf(KYC_PATTERNS.GET_MY_KYC);

    this.client.subscribeToResponseOf(KYC_PATTERNS.UPDATE_AADHAAR);

    this.client.subscribeToResponseOf(KYC_PATTERNS.UPLOAD_AADHAAR);

    this.client.subscribeToResponseOf(KYC_PATTERNS.UPLOAD_DOCUMENT);

    this.client.subscribeToResponseOf(KYC_PATTERNS.UPLOAD_VIDEO);

    this.client.subscribeToResponseOf(KYC_PATTERNS.UPDATE_DOCUMENT);

    this.client.subscribeToResponseOf(KYC_PATTERNS.DELETE_DOCUMENT);

    this.client.subscribeToResponseOf(KYC_PATTERNS.DELETE_VIDEO);

    this.client.subscribeToResponseOf(KYC_PATTERNS.GET_DOCUMENTS);

    await this.client.connect();
  }

  async create(dto: CreateKycDto) {
    return firstValueFrom(this.client.send(KYC_PATTERNS.CREATE_KYC, dto));
  }

  async submit(identityId: string) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.SUBMIT_KYC, {
        identityId,
      }),
    );
  }

  async getMyKyc(identityId: string) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.GET_MY_KYC, identityId),
    );
  }

  async uploadDocument(
    dto: UploadDocumentDto & {
      identityId: string;
    },
    file: S3FileMetadata,
  ) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.UPLOAD_DOCUMENT, {
        ...dto,

        identityId: dto.identityId,

        originalFileName: file.originalFileName,
        storedFileName: file.storedFileName,
        fileUrl: file.fileUrl,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
      }),
    );
  }

  async updateDocument(
    dto: UploadDocumentDto & {
      identityId: string;
    },
    file?: S3FileMetadata,
  ) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.UPDATE_DOCUMENT, {
        ...dto,

        identityId: dto.identityId,

        ...(file
          ? {
              originalFileName: file.originalFileName,
              storedFileName: file.storedFileName,
              fileUrl: file.fileUrl,
              mimeType: file.mimeType,
              fileSize: file.fileSize,
            }
          : {}),
      }),
    );
  }

  async uploadAadhaar(
    identityId: string,
    payload: UploadAadharDto & {
      frontImage: S3FileMetadata;
      backImage: S3FileMetadata;
    },
  ) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.UPLOAD_AADHAAR, {
        identityId,

        documentNumber: payload.documentNumber,

        frontImage: payload.frontImage,

        backImage: payload.backImage,
      }),
    );
  }

  async updateAadhaar(
    identityId: string,
    payload: UpdateAadhaarDto & {
      frontImage?: S3FileMetadata;
      backImage?: S3FileMetadata;
    },
  ) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.UPDATE_AADHAAR, {
        identityId,

        documentNumber: payload.documentNumber,

        frontImage: payload.frontImage ?? null,

        backImage: payload.backImage ?? null,
      }),
    );
  }

  async uploadVideo(
    identityId: string,
    dto: UploadVideoDto,
    file: S3FileMetadata,
  ) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.UPLOAD_VIDEO, {
        ...dto,

        identityId,

        originalFileName: file.originalFileName,

        storedFileName: file.storedFileName,

        fileUrl: file.fileUrl,

        mimeType: file.mimeType,

        fileSize: file.fileSize,
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

  async deleteDocument(documentId: string, identityId: string) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.DELETE_DOCUMENT, {
        documentId,
        identityId,
      }),
    );
  }

  async deleteVideo(videoId: string, identityId: string) {
    return firstValueFrom(
      this.client.send(KYC_PATTERNS.DELETE_VIDEO, {
        videoId,
        identityId,
      }),
    );
  }
}
