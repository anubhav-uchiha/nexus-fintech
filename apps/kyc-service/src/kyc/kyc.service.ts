import { Injectable, NotFoundException } from '@nestjs/common';
import { KycRepository } from './repository/kyc.repository';
import { CreateKycDto } from '@nexus/common/kyc/dto/create-kyc.dto';

@Injectable()
export class KycService {
  constructor(private readonly kycRepository: KycRepository) {}

  async create(dto: CreateKycDto) {
    console.log('SERVICE RECIVIED', dto);

    return this.kycRepository.create({
      identityId: dto.identityId,
      //   status: 'PENDING',
    });
  }

  async getMyKyc(identityId: string) {
    return this.kycRepository.findByIdentityId(identityId);
  }

  async uploadDocument(payload: any) {
    const kyc = await this.kycRepository.findByIdentityId(payload.identityId);
    if (!kyc) {
      throw new NotFoundException('KYC not found');
    }
    return this.kycRepository.createDocument({
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

  async getDocuments(identityId: string, page: number, limit: number) {
    page = Number(page);
    limit = Number(limit);
    const kyc = await this.kycRepository.findByIdentityId(identityId);
    if (!kyc) {
      throw new NotFoundException('KYC not found');
    }
    const { documents, total } = await this.kycRepository.getDocuments(
      kyc.id,
      page,
      limit,
    );
    return {
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }
}
