import { Injectable } from '@nestjs/common';
import { KycRepository } from './repository/kyc.repository';
import { CreateKycDto } from '@nexus/common/kyc/dto/create-kyc.dto';
import {
  DocumentStatus,
  DocumentType,
  VerificationStatus,
} from 'apps/kyc-service/generated/kyc-prisma/enums';
import { ensureKycEditable } from './helpers/kyc-status.helper';
import { validateAadhaarNumber } from './helpers/kyc-validation.helper';
import { isValidPan } from './utils/pan-validator';
import { isValidAadhaar } from './utils/aadhaar-validator';
import { RpcException } from '@nestjs/microservices';
import { S3Service } from '../storage/s3/s3.service';

@Injectable()
export class KycService {
  constructor(
    private readonly kycRepository: KycRepository,
    private readonly s3Service: S3Service,
  ) {}
  private async getKycOrThrow(identityId: string) {
    const kyc = await this.kycRepository.findByIdentityId(identityId);

    if (!kyc) {
      throw new RpcException({ statusCode: 404, message: 'KYC not found' });
    }

    return kyc;
  }

  async create(dto: CreateKycDto) {
    const existing = await this.kycRepository.findByIdentityId(dto.identityId);

    if (existing) {
      return existing;
    }
    return this.kycRepository.create({
      identityId: dto.identityId,
    });
  }

  async getMyKyc(identityId: string) {
    return await this.getKycOrThrow(identityId);
  }

  async uploadDocument(payload: any) {
    const kyc = await this.getKycOrThrow(payload.identityId);
    ensureKycEditable(kyc.status);
    if (
      payload.documentType === DocumentType.AADHAAR_FRONT ||
      payload.documentType === DocumentType.AADHAAR_BACK
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Aadhaar documents cannot uploaded',
      });
    }
    const existing = await this.kycRepository.findDocument(
      kyc.id,
      payload.documentType,
    );
    if (existing) {
      throw new RpcException({
        statusCode: 409,
        message: `${payload.documentType} already uploaded`,
      });
    }
    if (payload.documentNumber) {
      payload.documentNumber = payload.documentNumber.trim().toUpperCase();
    }

    if (payload.documentType === DocumentType.PAN_CARD) {
      if (
        !payload.documentNumber ||
        typeof payload.documentNumber !== 'string' ||
        !payload.documentNumber.trim()
      ) {
        throw new RpcException({
          statusCode: 400,
          message: 'PAN number is required for PAN card',
        });
      }

      payload.documentNumber = payload.documentNumber.trim().toUpperCase();

      if (!isValidPan(payload.documentNumber)) {
        throw new RpcException({
          statusCode: 400,
          message: 'Invalid PAN number',
        });
      }

      const duplicate = await this.kycRepository.findDocumentByTypeAndNumber(
        payload.documentType,
        payload.documentNumber,
      );
      if (duplicate && duplicate.kycId !== kyc.id) {
        throw new RpcException({
          statusCode: 409,
          message: `${payload.documentType} is already registered with another account`,
        });
      }
    }
    return await this.kycRepository.createDocument({
      kyc: {
        connect: {
          id: kyc.id,
        },
      },
      documentType: payload.documentType,
      documentNumber: payload.documentNumber,
      originalFileName: payload.originalFileName,
      storedFileName: payload.storedFileName,
      fileUrl: payload.fileUrl,
      mimeType: payload.mimeType,
      fileSize: payload.fileSize,
    });
  }

  async uploadAadhaar(payload: any) {
    const kyc = await this.getKycOrThrow(payload.identityId);

    ensureKycEditable(kyc.status);

    if (!payload.documentNumber) {
      throw new RpcException({
        statusCode: 400,
        message: 'Aadhaar number is required',
      });
    }

    const documentNumber = validateAadhaarNumber(payload.documentNumber.trim());

    if (!payload.frontImage || !payload.backImage) {
      throw new RpcException({
        statusCode: 400,
        message: 'Both Aadhaar front and back images are required',
      });
    }

    const front = await this.kycRepository.findDocument(
      kyc.id,
      DocumentType.AADHAAR_FRONT,
    );

    const back = await this.kycRepository.findDocument(
      kyc.id,
      DocumentType.AADHAAR_BACK,
    );

    if (front || back) {
      throw new RpcException({
        statusCode: 409,
        message: 'Aadhaar has already been uploaded.',
      });
    }

    const duplicateFront = await this.kycRepository.findDocumentByTypeAndNumber(
      DocumentType.AADHAAR_FRONT,
      documentNumber,
    );

    if (duplicateFront && duplicateFront.kycId !== kyc.id) {
      throw new RpcException({
        statusCode: 409,
        message: 'Aadhaar number already belongs to another user.',
      });
    }

    return await this.kycRepository.createAadhaar(
      kyc.id,
      documentNumber,
      payload.frontImage,
      payload.backImage,
    );
  }

  async uploadVideo(payload: any) {
    const kyc = await this.getKycOrThrow(payload.identityId);

    ensureKycEditable(kyc.status);

    if (!payload.originalFileName) {
      throw new RpcException({
        statusCode: 400,
        message: 'Video file is required',
      });
    }

    if (!payload.storedFileName || !payload.fileUrl) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid video file data',
      });
    }

    const existing = await this.kycRepository.getVideoByKycId(kyc.id);

    if (!existing) {
      return this.kycRepository.createVideo({
        kyc: {
          connect: {
            id: kyc.id,
          },
        },
        originalFileName: payload.originalFileName,
        storedFileName: payload.storedFileName,
        fileUrl: payload.fileUrl,
        mimeType: payload.mimeType,
        fileSize: payload.fileSize,
        status: 'PENDING',
      });
    }
    const oldFileKey = existing.storedFileName;
    try {
      const result = await this.kycRepository.updateVideo(existing.id, {
        originalFileName: payload.originalFileName,
        storedFileName: payload.storedFileName,
        fileUrl: payload.fileUrl,
        mimeType: payload.mimeType,
        fileSize: payload.fileSize,
        status: 'PENDING',
        durationSeconds: null,
        rejectionReason: null,
        reviewedAt: null,
        reviewedBy: null,
      });
      if (oldFileKey && oldFileKey !== payload.storedFileName) {
        try {
          await this.s3Service.delete(oldFileKey);
        } catch (error) {
          console.error('Failed to delete old video:', oldFileKey, error);
        }
      }
      return result;
    } catch (error) {
      if (payload.storedFileName && payload.storedFileName !== oldFileKey) {
        try {
          await this.s3Service.delete(payload.storedFileName);
        } catch {}
      }

      throw error;
    }
  }

  async updateDocument(payload: any) {
    const kyc = await this.getKycOrThrow(payload.identityId);

    ensureKycEditable(kyc.status);
    if (
      payload.documentType === DocumentType.AADHAAR_FRONT ||
      payload.documentType === DocumentType.AADHAAR_BACK
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Aadhaar documents must be updated separately',
      });
    }

    const existing = await this.kycRepository.findDocument(
      kyc.id,
      payload.documentType,
    );

    if (!existing) {
      throw new RpcException({
        statusCode: 404,
        message: `${payload.documentType} not uploaded`,
      });
    }

    if (payload.documentType === DocumentType.PAN_CARD) {
      if (
        !payload.documentNumber ||
        typeof payload.documentNumber !== 'string' ||
        !payload.documentNumber.trim()
      ) {
        if (!payload.storedFileName) {
          throw new RpcException({
            statusCode: 400,
            message: 'PAN number is required for PAN card',
          });
        }
      } else {
        payload.documentNumber = payload.documentNumber.trim().toUpperCase();

        if (!isValidPan(payload.documentNumber)) {
          throw new RpcException({
            statusCode: 400,
            message: 'Invalid PAN number',
          });
        }

        const duplicate = await this.kycRepository.findDocumentByTypeAndNumber(
          DocumentType.PAN_CARD,
          payload.documentNumber,
        );

        if (duplicate && duplicate.kycId !== kyc.id) {
          throw new RpcException({
            statusCode: 409,
            message: 'PAN number is already registered with another account',
          });
        }
      }
    } else if (payload.documentNumber) {
      payload.documentNumber = payload.documentNumber.trim().toUpperCase();
    }

    const hasNewFile =
      !!payload.originalFileName &&
      !!payload.storedFileName &&
      !!payload.fileUrl;

    if (!hasNewFile) {
      if (
        !payload.documentNumber ||
        typeof payload.documentNumber !== 'string' ||
        !payload.documentNumber.trim()
      ) {
        throw new RpcException({
          statusCode: 400,
          message: 'Document number or document file is required',
        });
      }

      return this.kycRepository.updateDocument(existing.id, {
        documentNumber: payload.documentNumber,

        originalFileName: existing.originalFileName,
        storedFileName: existing.storedFileName,
        fileUrl: existing.fileUrl,
        mimeType: existing.mimeType,
        fileSize: existing.fileSize,

        status: DocumentStatus.PENDING,
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
      });
    }

    const oldFileKey = existing.storedFileName;

    const documentNumber =
      payload.documentNumber !== undefined &&
      payload.documentNumber !== null &&
      String(payload.documentNumber).trim()
        ? String(payload.documentNumber).trim().toUpperCase()
        : existing.documentNumber;

    try {
      const result = await this.kycRepository.updateDocument(existing.id, {
        documentNumber,

        originalFileName: payload.originalFileName,
        storedFileName: payload.storedFileName,
        fileUrl: payload.fileUrl,
        mimeType: payload.mimeType,
        fileSize: payload.fileSize,

        status: DocumentStatus.PENDING,
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
      });
      if (oldFileKey && oldFileKey !== payload.storedFileName) {
        try {
          await this.s3Service.delete(oldFileKey);
        } catch (error) {
          console.error('Failed to delete old S3 document:', oldFileKey, error);
        }
      }

      return result;
    } catch (error) {
      if (payload.storedFileName && payload.storedFileName !== oldFileKey) {
        try {
          await this.s3Service.delete(payload.storedFileName);
        } catch (cleanupError) {
          console.error(
            'Failed to cleanup new S3 document:',
            payload.storedFileName,
            cleanupError,
          );
        }
      }

      throw error;
    }
  }

  async updateAadhaar(payload: any) {
    const kyc = await this.getKycOrThrow(payload.identityId);
    ensureKycEditable(kyc.status);
    const front = await this.kycRepository.findDocument(
      kyc.id,
      DocumentType.AADHAAR_FRONT,
    );
    const back = await this.kycRepository.findDocument(
      kyc.id,
      DocumentType.AADHAAR_BACK,
    );
    if (!front && !back) {
      throw new RpcException({
        statusCode: 404,
        message: 'Aadhaar documents not uploaded. Use upload Aadhaar first.',
      });
    }
    let documentNumber: string | undefined;
    if (front?.documentNumber) {
      documentNumber = front.documentNumber.trim();
    } else if (back?.documentNumber) {
      documentNumber = back.documentNumber.trim();
    }
    if (payload.documentNumber) {
      const newDocumentNumber = validateAadhaarNumber(
        payload.documentNumber.trim(),
      );
      const duplicate = await this.kycRepository.findDocumentByTypeAndNumber(
        DocumentType.AADHAAR_FRONT,
        newDocumentNumber,
      );
      if (duplicate && duplicate.kycId !== kyc.id) {
        throw new RpcException({
          statusCode: 409,
          message: 'Aadhaar number already belongs to another user',
        });
      }

      documentNumber = newDocumentNumber;
    }

    if (!documentNumber) {
      throw new RpcException({
        statusCode: 400,
        message: 'Aadhaar number is required',
      });
    }

    if (!isValidAadhaar(documentNumber)) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid Aadhaar number',
      });
    }

    const oldFrontFileKey = front?.storedFileName ?? null;

    const oldBackFileKey = back?.storedFileName ?? null;

    const frontData = payload.frontImage
      ? {
          originalFileName: payload.frontImage.originalFileName,
          storedFileName: payload.frontImage.storedFileName,
          fileUrl: payload.frontImage.fileUrl,
          mimeType: payload.frontImage.mimeType,
          fileSize: payload.frontImage.fileSize,
          status: DocumentStatus.PENDING,
          rejectionReason: null,
          reviewedAt: null,
          reviewedBy: null,
        }
      : front
        ? {
            status: DocumentStatus.PENDING,
            rejectionReason: null,
            reviewedAt: null,
            reviewedBy: null,
          }
        : null;

    const backData = payload.backImage
      ? {
          originalFileName: payload.backImage.originalFileName,
          storedFileName: payload.backImage.storedFileName,
          fileUrl: payload.backImage.fileUrl,
          mimeType: payload.backImage.mimeType,
          fileSize: payload.backImage.fileSize,
          status: DocumentStatus.PENDING,
          rejectionReason: null,
          reviewedAt: null,
          reviewedBy: null,
        }
      : back
        ? {
            status: DocumentStatus.PENDING,
            rejectionReason: null,
            reviewedAt: null,
            reviewedBy: null,
          }
        : null;

    try {
      const result = await this.kycRepository.upsertAadhaar(
        kyc.id,
        documentNumber,
        frontData,
        backData,
      );
      if (
        payload.frontImage &&
        oldFrontFileKey &&
        oldFrontFileKey !== payload.frontImage.storedFileName
      ) {
        try {
          await this.s3Service.delete(oldFrontFileKey);
        } catch (error) {
          console.error(
            'Failed to delete old Aadhaar front:',
            oldFrontFileKey,
            error,
          );
        }
      }

      if (
        payload.backImage &&
        oldBackFileKey &&
        oldBackFileKey !== payload.backImage.storedFileName
      ) {
        try {
          await this.s3Service.delete(oldBackFileKey);
        } catch (error) {
          console.error(
            'Failed to delete old Aadhaar back:',
            oldBackFileKey,
            error,
          );
        }
      }

      return result;
    } catch (error) {
      if (
        payload.frontImage?.storedFileName &&
        payload.frontImage.storedFileName !== oldFrontFileKey
      ) {
        try {
          await this.s3Service.delete(payload.frontImage.storedFileName);
        } catch (cleanupError) {
          console.error(
            'Failed to cleanup new Aadhaar front s3 object:',
            payload.frontImage.storedFileName,
            cleanupError,
          );
        }
      }

      if (
        payload.backImage?.storedFileName &&
        payload.backImage.storedFileName !== oldBackFileKey
      ) {
        try {
          await this.s3Service.delete(payload.backImage.storedFileName);
        } catch (cleanupError) {
          console.error(
            'failed to cleanup new Aadhaar back s3 object:',
            payload.backImage.storedFileName,
            cleanupError,
          );
        }
      }

      throw error;
    }
  }

  async getDocuments(identityId: string, page: number, limit: number) {
    page = Number(page);
    limit = Number(limit);

    if (!Number.isInteger(page) || page < 1) {
      throw new RpcException({
        statusCode: 400,
        message: 'Page must be a positive integer',
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RpcException({
        statusCode: 400,
        message: 'Limit must be between 1 and 100',
      });
    }

    const kyc = await this.kycRepository.findByIdentityId(identityId);

    if (!kyc) {
      throw new RpcException({
        statusCode: 404,
        message: 'KYC not found',
      });
    }

    const { documents, total } = await this.kycRepository.getDocuments(
      kyc.id,
      page,
      limit,
    );

    const documentsWithPreviewUrl = await Promise.all(
      documents.map(async (document) => {
        let previewUrl: string | null = null;

        if (document.fileUrl) {
          previewUrl = await this.s3Service.createDownloadUrl(
            document.fileUrl,
            900,
          );
        }
        return {
          ...document,
          previewUrl,
        };
      }),
    );

    const video = await this.kycRepository.getVideoByKycId(kyc.id);

    let videoWithPreviewUrl = null;
    if (video) {
      let previewUrl: string | null = null;
      if (video.fileUrl) {
        previewUrl = await this.s3Service.createDownloadUrl(video.fileUrl, 900);
      }
      videoWithPreviewUrl = {
        ...video,
        previewUrl,
      };
    }

    const totalPages = Math.ceil(total / limit);

    return {
      kyc: {
        id: kyc.id,
        status: kyc.status,
      },

      documents: documentsWithPreviewUrl,

      video: videoWithPreviewUrl,

      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        hasVideo: !!video,
      },
    };
  }

  async deleteDocument(documentId: string, identityId: string) {
    const document = await this.kycRepository.findDocumentById(documentId);

    if (!document) {
      throw new RpcException({
        statusCode: 404,
        message: 'Document not found',
      });
    }

    if (document.kyc.identityId !== identityId) {
      throw new RpcException({
        statusCode: 403,
        message: 'You are not allowed to delete this document',
      });
    }

    ensureKycEditable(document.kyc.status);

    const s3Key = document.storedFileName;

    await this.kycRepository.deleteDocument(documentId);

    if (s3Key) {
      try {
        await this.s3Service.delete(s3Key);
      } catch (error) {
        console.error('Failed to delete S3 document:', s3Key, error);
      }
    }

    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }

  async submitKyc(identityId: string) {
    const kyc = await this.getKycOrThrow(identityId);

    ensureKycEditable(kyc.status);

    const documents = await this.kycRepository.getDocumentsByKycId(kyc.id);

    const uploadedDocumentTypes = new Set(
      documents.map((document) => document.documentType),
    );

    const requiredDocuments = [
      DocumentType.PAN_CARD,
      DocumentType.AADHAAR_FRONT,
      DocumentType.AADHAAR_BACK,
      DocumentType.SIGNATURE,
      DocumentType.SHOP_FRONT,
      DocumentType.BUSINESS_PROOF,
    ];

    const missingDocuments = requiredDocuments.filter(
      (documentType) => !uploadedDocumentTypes.has(documentType),
    );

    if (missingDocuments.length > 0) {
      throw new RpcException({
        statusCode: 400,
        message: {
          message: 'Missing required documents',
          missingDocuments,
        },
      });
    }

    const video = await this.kycRepository.getVideoByKycId(kyc.id);

    if (!video) {
      throw new RpcException({
        statusCode: 400,
        message: 'Video verification is required',
      });
    }

    if (video.status !== VerificationStatus.PENDING) {
      throw new RpcException({
        statusCode: 400,
        message: 'Video must be in PENDING status before KYC submission',
      });
    }

    await this.kycRepository.submitKyc(kyc.id);

    return {
      success: true,
      message: 'KYC submitted successfully',
    };
  }

  async deleteVideo(videoId: string, identityId: string) {
    const video = await this.kycRepository.findVideoById(videoId);

    if (!video) {
      throw new RpcException({
        statusCode: 404,
        message: 'Video not found',
      });
    }

    if (video.kyc.identityId !== identityId) {
      throw new RpcException({
        statusCode: 403,
        message: 'You are not allowed to delete this video',
      });
    }

    ensureKycEditable(video.kyc.status);

    const s3Key = video.storedFileName;

    await this.kycRepository.deleteVideo(videoId);

    if (s3Key) {
      try {
        await this.s3Service.delete(s3Key);
      } catch (error) {
        console.error('Failed to delete S3 video:', s3Key, error);
      }
    }

    return {
      success: true,
      message: 'Video deleted successfully',
    };
  }
}
