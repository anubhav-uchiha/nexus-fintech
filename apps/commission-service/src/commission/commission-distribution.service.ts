import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCommissionDistributionDto } from '@nexus/common/commission/dto/create-commission-distribution.dto';
import { RpcException } from '@nestjs/microservices';
import { UpdateCommissionDistributionDto } from '@nexus/common/commission/dto/update-commission-distribution.dto';

@Injectable()
export class CommissionDistributionService {
  constructor(private readonly prisma: PrismaService) {}
  async createDistribution(dto: CreateCommissionDistributionDto) {
    if (!dto.commissionRuleId?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Commission rule ID is required',
      });
    }

    if (!dto.recipientRole?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Recipient role is required',
      });
    }

    if (
      typeof dto.distributionValue !== 'number' ||
      !Number.isFinite(dto.distributionValue) ||
      dto.distributionValue < 0
    ) {
      throw new RpcException({
        status: 400,
        message: 'Distribution value must be greater than or equal to 0',
      });
    }
    const rule = await this.prisma.commissionRule.findUnique({
      where: {
        id: dto.commissionRuleId,
      },
    });

    if (!rule) {
      throw new RpcException({
        status: 404,
        message: 'Commission rule not found',
      });
    }

    try {
      return await this.prisma.commissionDistribution.create({
        data: {
          commissionRuleId: dto.commissionRuleId,
          recipientRole: dto.recipientRole,
          distributionType: dto.distributionType,
          distributionValue: dto.distributionValue,
          priority: dto.priority ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: any) {
      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Failed to create commission distribution',
      });
    }
  }

  async getDistributions(commissionRuleId?: string) {
    return this.prisma.commissionDistribution.findMany({
      where: commissionRuleId ? { commissionRuleId } : undefined,
      orderBy: [
        {
          priority: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  async getDistribution(id: string) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Distribution ID is required',
      });
    }
    const distribution = await this.prisma.commissionDistribution.findUnique({
      where: {
        id,
      },
    });

    if (!distribution) {
      throw new RpcException({
        status: 404,
        message: 'Commission distribution not found',
      });
    }

    return distribution;
  }

  async updateDistribution(id: string, dto: UpdateCommissionDistributionDto) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Distribution ID is required',
      });
    }

    await this.getDistribution(id);

    if (
      dto.distributionValue !== undefined &&
      (typeof dto.distributionValue !== 'number' ||
        !Number.isFinite(dto.distributionValue) ||
        dto.distributionValue < 0)
    ) {
      throw new RpcException({
        status: 400,
        message: 'Distribution value must be greater than or equal to 0',
      });
    }

    try {
      return await this.prisma.commissionDistribution.update({
        where: {
          id,
        },

        data: {
          ...(dto.recipientRole !== undefined && {
            recipientRole: dto.recipientRole,
          }),

          ...(dto.distributionType !== undefined && {
            distributionType: dto.distributionType,
          }),

          ...(dto.distributionValue !== undefined && {
            distributionValue: dto.distributionValue,
          }),

          ...(dto.priority !== undefined && {
            priority: dto.priority,
          }),

          ...(dto.isActive !== undefined && {
            isActive: dto.isActive,
          }),
        },
      });
    } catch (error: any) {
      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Failed to update commission distribution',
      });
    }
  }

  async deleteDistribution(id: string) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Distribution ID is required',
      });
    }

    await this.getDistribution(id);

    return this.prisma.commissionDistribution.update({
      where: {
        id,
      },

      data: {
        isActive: false,
      },
    });
  }
}
