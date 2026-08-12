import { Controller } from '@nestjs/common';

import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateKycDto } from '@nexus/common/kyc/dto/create-kyc.dto';
import { UploadDocumentDto } from '@nexus/common/kyc/dto/upload-document.dto';
import { UploadVideoDto } from '@nexus/common/kyc/dto/upload-video.dto';
import { UploadAadharDto } from '@nexus/common/kyc/dto/upload-aadhar-dto';
import { UpdateAadhaarDto } from '@nexus/common/kyc/dto/update-aadhaar.dto';

import { KYC_PATTERNS } from '@nexus/common/kyc/kyc.patterns';

import { KycService } from './kyc.service';

@Controller()
export class KycKafkaController {
  constructor(private readonly kycService: KycService) {}

  @MessagePattern(KYC_PATTERNS.CREATE_KYC)
  async createKyc(@Payload() dto: CreateKycDto) {
    return this.kycService.create(dto);
  }

  @MessagePattern(KYC_PATTERNS.SUBMIT_KYC)
  async submitKyc(
    @Payload()
    payload: {
      identityId: string;
    },
  ) {
    return this.kycService.submitKyc(payload.identityId);
  }

  @MessagePattern(KYC_PATTERNS.GET_MY_KYC)
  async getMyKyc(@Payload() identityId: string) {
    return this.kycService.getMyKyc(identityId);
  }

  @MessagePattern(KYC_PATTERNS.UPLOAD_DOCUMENT)
  async uploadDocument(
    @Payload()
    payload: UploadDocumentDto & {
      identityId: string;
      originalFileName: string;
      storedFileName: string;
      fileUrl: string;
      mimeType: string;
      fileSize: number;
    },
  ) {
    return this.kycService.uploadDocument(payload);
  }

  @MessagePattern(KYC_PATTERNS.UPLOAD_AADHAAR)
  async uploadAadhaar(
    @Payload()
    payload: UploadAadharDto & {
      identityId: string;

      frontImage: {
        originalFileName: string;
        storedFileName: string;
        fileUrl: string;
        mimeType: string;
        fileSize: number;
      };

      backImage: {
        originalFileName: string;
        storedFileName: string;
        fileUrl: string;
        mimeType: string;
        fileSize: number;
      };
    },
  ) {
    return this.kycService.uploadAadhaar(payload);
  }

  @MessagePattern(KYC_PATTERNS.UPDATE_AADHAAR)
  async updateAadhaar(
    @Payload()
    payload: UpdateAadhaarDto & {
      identityId: string;

      frontImage?: {
        originalFileName: string;
        storedFileName: string;
        fileUrl: string;
        mimeType: string;
        fileSize: number;
      } | null;

      backImage?: {
        originalFileName: string;
        storedFileName: string;
        fileUrl: string;
        mimeType: string;
        fileSize: number;
      } | null;
    },
  ) {
    return this.kycService.updateAadhaar(payload);
  }

  @MessagePattern(KYC_PATTERNS.UPLOAD_VIDEO)
  async uploadVideo(
    @Payload()
    payload: UploadVideoDto & {
      identityId: string;
      originalFileName: string;
      storedFileName: string;
      fileUrl: string;
      mimeType: string;
      fileSize: number;
    },
  ) {
    return this.kycService.uploadVideo(payload);
  }

  @MessagePattern(KYC_PATTERNS.UPDATE_DOCUMENT)
  async updateDocument(
    @Payload()
    payload: UploadDocumentDto & {
      identityId: string;
      originalFileName: string;
      storedFileName: string;
      fileUrl: string;
      mimeType: string;
      fileSize: number;
    },
  ) {
    return this.kycService.updateDocument(payload);
  }

  @MessagePattern(KYC_PATTERNS.GET_DOCUMENTS)
  async getDocuments(
    @Payload()
    payload: {
      identityId: string;
      page: number;
      limit: number;
    },
  ) {
    return this.kycService.getDocuments(
      payload.identityId,
      Number(payload.page),
      Number(payload.limit),
    );
  }

  @MessagePattern(KYC_PATTERNS.DELETE_DOCUMENT)
  async deleteDocument(
    @Payload()
    payload: {
      documentId: string;
      identityId: string;
    },
  ) {
    return this.kycService.deleteDocument(
      payload.documentId,
      payload.identityId,
    );
  }

  @MessagePattern(KYC_PATTERNS.DELETE_VIDEO)
  async deleteVideo(
    @Payload()
    payload: {
      videoId: string;
      identityId: string;
    },
  ) {
    return this.kycService.deleteVideo(payload.videoId, payload.identityId);
  }
}
