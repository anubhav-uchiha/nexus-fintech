import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  KycStatus,
  Prisma,
} from 'apps/kyc-service/generated/kyc-prisma/client';
import {
  DocumentStatus,
  DocumentType,
} from 'apps/kyc-service/generated/kyc-prisma/enums';
import { RpcException } from '@nestjs/microservices';
import { isPrismaUniqueConstraintError } from '../helpers/prisma.helper';

@Injectable()
export class KycRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDocument(data: Prisma.KycDocumentCreateInput) {
    try {
      return await this.prisma.kycDocument.create({
        data,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        const documentType = data.documentType;
        if (documentType === DocumentType.PAN_CARD) {
          throw new RpcException({
            statusCode: 409,
            message: 'PAN number is already registered with another account',
          });
        }

        if (
          documentType === DocumentType.AADHAAR_FRONT ||
          documentType === DocumentType.AADHAAR_BACK
        ) {
          throw new RpcException({
            statusCode: 409,
            message: 'Aadhaar number already belongs to another user',
          });
        }
        throw new RpcException({
          statusCode: 409,
          message: 'This document type has already been uploaded',
        });
      }
      throw error;
    }
  }

  async create(data: Prisma.KycCreateInput) {
    try {
      return await this.prisma.kyc.create({
        data,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new RpcException({
          statusCode: 409,
          message: 'KYC already exists for this account',
        });
      }
      throw error;
    }
  }

  async createVideo(data: any) {
    try {
      return await this.prisma.kycVideoVerification.create({
        data,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new RpcException({
          statusCode: 409,
          message: 'Video verification already exists for this KYC',
        });
      }
      throw error;
    }
  }

  async createAadhaar(
    kycId: string,
    documentNumber: string,
    frontImage: any,
    backImage: any,
  ) {
    try {
      return await this.prisma.$transaction([
        this.prisma.kycDocument.create({
          data: {
            kycId,
            documentType: DocumentType.AADHAAR_FRONT,
            documentNumber,

            originalFileName: frontImage.originalFileName,
            storedFileName: frontImage.storedFileName,
            fileUrl: frontImage.fileUrl,
            mimeType: frontImage.mimeType,
            fileSize: frontImage.fileSize,
          },
        }),

        this.prisma.kycDocument.create({
          data: {
            kycId,
            documentType: DocumentType.AADHAAR_BACK,
            documentNumber,

            originalFileName: backImage.originalFileName,
            storedFileName: backImage.storedFileName,
            fileUrl: backImage.fileUrl,
            mimeType: backImage.mimeType,
            fileSize: backImage.fileSize,
          },
        }),
      ]);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new RpcException({
          statusCode: 409,
          message: 'Aadhaar number already belongs to another user',
        });
      }
      throw error;
    }
  }

  async findById(id: string) {
    return this.prisma.kyc.findUnique({
      where: { id },
      include: { documents: true, video: true },
    });
  }

  async findVideoById(videoId: string) {
    return this.prisma.kycVideoVerification.findUnique({
      where: { id: videoId },
      include: {
        kyc: true,
      },
    });
  }

  async findDocumentByTypeAndNumber(
    documentType: DocumentType,
    documentNumber: string,
  ) {
    return this.prisma.kycDocument.findFirst({
      where: { documentType, documentNumber },
      select: {
        id: true,
        kycId: true,
        documentNumber: true,
        documentType: true,
      },
    });
  }

  findByIdentityId(identityId: string) {
    return this.prisma.kyc.findUnique({
      where: { identityId },
      include: { documents: true, video: true },
    });
  }

  async findDocument(kycId: string, documentType: DocumentType) {
    return this.prisma.kycDocument.findUnique({
      where: {
        kycId_documentType: {
          kycId,
          documentType,
        },
      },
    });
  }
  async findDocumentById(documentId: string) {
    return this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      include: { kyc: true },
    });
  }

  async getDocumentsByKycId(kycId: string) {
    return this.prisma.kycDocument.findMany({
      where: {
        kycId,
      },
      select: {
        documentType: true,
      },
    });
  }
  async getVideoByKycId(kycId: string) {
    return this.prisma.kycVideoVerification.findUnique({
      where: { kycId },
      select: {
        id: true,
        kycId: true,
        originalFileName: true,
        storedFileName: true,
        fileUrl: true,
        mimeType: true,
        fileSize: true,
        durationSeconds: true,
        status: true,
        rejectionReason: true,
        reviewedBy: true,
        uploadedAt: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async submitKyc(kycId: string) {
    return this.prisma.kyc.update({
      where: {
        id: kycId,
      },
      data: {
        status: KycStatus.UNDER_REVIEW,
        submittedAt: new Date(),
      },
    });
  }

  async getDocuments(kycId: string, page: number, limit: number) {
    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;
    const [documents, total] = await this.prisma.$transaction([
      this.prisma.kycDocument.findMany({
        where: {
          kycId,
        },
        orderBy: {
          uploadedAt: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.kycDocument.count({
        where: {
          kycId,
        },
      }),
    ]);

    return {
      documents,
      total,
    };
  }

  async updateDocument(
    documentId: string,
    data: Prisma.KycDocumentUpdateInput,
  ) {
    const existing = await this.prisma.kycDocument.findUnique({
      where: {
        id: documentId,
      },
      select: {
        id: true,
        documentType: true,
      },
    });
    try {
      return await this.prisma.kycDocument.update({
        where: {
          id: documentId,
        },
        data,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        if (existing?.documentType === DocumentType.PAN_CARD) {
          throw new RpcException({
            statusCode: 409,
            message: 'PAN number is already registered with another account',
          });
        }
        if (
          existing?.documentType === DocumentType.AADHAAR_FRONT ||
          existing?.documentType === DocumentType.AADHAAR_BACK
        ) {
          throw new RpcException({
            statusCode: 409,
            message: 'Aadhaar number already belongs to another user',
          });
        }
        throw new RpcException({
          statusCode: 409,
          message: 'This document type has already been uploaded',
        });
      }
      throw error;
    }
  }

  async updateAadhaar(
    frontId: string,
    backId: string,
    frontData: any,
    backData: any,
  ) {
    try {
      return await this.prisma.$transaction([
        this.prisma.kycDocument.update({
          where: {
            id: frontId,
          },
          data: frontData,
        }),

        this.prisma.kycDocument.update({
          where: {
            id: backId,
          },
          data: backData,
        }),
      ]);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new RpcException({
          statusCode: 409,
          message: 'Aadhaar number already belongs to another user',
        });
      }
      throw error;
    }
  }

  async upsertAadhaar(
    kycId: string,
    documentNumber: string,
    frontData: any | null,
    backData: any | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingFront = await tx.kycDocument.findUnique({
          where: {
            kycId_documentType: {
              kycId,
              documentType: DocumentType.AADHAAR_FRONT,
            },
          },
        });

        const existingBack = await tx.kycDocument.findUnique({
          where: {
            kycId_documentType: {
              kycId,
              documentType: DocumentType.AADHAAR_BACK,
            },
          },
        });

        let front;
        let back;

        if (existingFront) {
          front = await tx.kycDocument.update({
            where: {
              id: existingFront.id,
            },
            data: {
              documentNumber,

              ...(frontData ?? {}),

              status: DocumentStatus.PENDING,
              rejectionReason: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          });
        } else if (frontData) {
          if (
            !frontData.originalFileName ||
            !frontData.storedFileName ||
            !frontData.fileUrl ||
            !frontData.mimeType ||
            frontData.fileSize === undefined ||
            frontData.fileSize === null
          ) {
            throw new RpcException({
              statusCode: 400,
              message: 'Aadhaar front image data is required',
            });
          }

          front = await tx.kycDocument.create({
            data: {
              kycId,
              documentType: DocumentType.AADHAAR_FRONT,
              documentNumber,

              originalFileName: frontData.originalFileName,
              storedFileName: frontData.storedFileName,
              fileUrl: frontData.fileUrl,
              mimeType: frontData.mimeType,
              fileSize: frontData.fileSize,

              status: DocumentStatus.PENDING,
              rejectionReason: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          });
        }

        if (existingBack) {
          back = await tx.kycDocument.update({
            where: {
              id: existingBack.id,
            },
            data: {
              documentNumber,

              ...(backData ?? {}),

              status: DocumentStatus.PENDING,
              rejectionReason: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          });
        } else if (backData) {
          if (
            !backData.originalFileName ||
            !backData.storedFileName ||
            !backData.fileUrl ||
            !backData.mimeType ||
            backData.fileSize === undefined ||
            backData.fileSize === null
          ) {
            throw new RpcException({
              statusCode: 400,
              message: 'Aadhaar back image data is required',
            });
          }

          back = await tx.kycDocument.create({
            data: {
              kycId,
              documentType: DocumentType.AADHAAR_BACK,
              documentNumber,

              originalFileName: backData.originalFileName,
              storedFileName: backData.storedFileName,
              fileUrl: backData.fileUrl,
              mimeType: backData.mimeType,
              fileSize: backData.fileSize,

              status: DocumentStatus.PENDING,
              rejectionReason: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          });
        }

        return {
          front,
          back,
        };
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new RpcException({
          statusCode: 409,
          message: 'Aadhaar number already belongs to another user',
        });
      }
      throw error;
    }
  }

  async updateVideo(id: string, data: any) {
    return this.prisma.kycVideoVerification.update({ where: { id }, data });
  }

  async deleteDocument(documentId: string) {
    return this.prisma.kycDocument.delete({ where: { id: documentId } });
  }
  async deleteVideo(videoId: string) {
    return this.prisma.kycVideoVerification.delete({
      where: {
        id: videoId,
      },
    });
  }
}
