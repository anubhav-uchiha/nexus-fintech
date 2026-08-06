import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from 'apps/kyc-service/generated/kyc-prisma/client';

@Injectable()
export class KycRepository {
  constructor(private readonly prisma: PrismaService) {}

  createDocument(data: Prisma.KycDocumentCreateInput) {
    return this.prisma.kycDocument.create({
      data,
    });
  }
  create(data: Prisma.KycCreateInput) {
    return this.prisma.kyc.create({
      data,
    });
  }

  findById(id: string) {
    return this.prisma.kyc.findUnique({
      where: { id },
      include: { documents: true, video: true },
    });
  }

  findByIdentityId(identityId: string) {
    return this.prisma.kyc.findUnique({
      where: { identityId },
      include: { documents: true, video: true },
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

  update(id: string, data: Prisma.KycUpdateInput) {
    return this.prisma.kyc.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.prisma.kyc.delete({ where: { id } });
  }
}
