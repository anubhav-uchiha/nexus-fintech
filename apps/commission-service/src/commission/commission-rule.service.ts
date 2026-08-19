import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../database/prisma.service';
import { CreateCommissionRuleDto } from '@nexus/common/commission/dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from '@nexus/common/commission/dto/update-commission-rule.dto';

@Injectable()
export class CommissionRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(dto: CreateCommissionRuleDto) {
    if (!dto.serviceType?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Service type is required',
      });
    }

    if (!dto.role?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Role is required',
      });
    }

    if (dto.commissionValue < 0) {
      throw new RpcException({
        status: 400,
        message: 'Commission value cannot be negative',
      });
    }

    if (
      dto.minAmount !== undefined &&
      dto.maxAmount !== undefined &&
      dto.minAmount > dto.maxAmount
    ) {
      throw new RpcException({
        status: 400,
        message: 'Minimum amount cannot be greater than maximum amount',
      });
    }

    try {
      return await this.prisma.commissionRule.create({
        data: {
          serviceType: dto.serviceType,
          operator: dto.operator,
          role: dto.role,
          commissionType: dto.commissionType,
          commissionValue: dto.commissionValue,
          minAmount: dto.minAmount,
          maxAmount: dto.maxAmount,
          priority: dto.priority ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: any) {
      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Failed to create commission rule',
      });
    }
  }

  async getRules() {
    return this.prisma.commissionRule.findMany({
      orderBy: [
        { serviceType: 'asc' },
        { role: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async getRule(id: string) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Rule ID is required',
      });
    }

    const rule = await this.prisma.commissionRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new RpcException({
        status: 404,
        message: 'Commission rule not found',
      });
    }

    return rule;
  }

  async updateRule(id: string, dto: UpdateCommissionRuleDto) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Rule ID is required',
      });
    }

    await this.getRule(id);

    if (
      dto.minAmount != null &&
      dto.maxAmount != null &&
      dto.minAmount > dto.maxAmount
    ) {
      throw new RpcException({
        status: 400,
        message: 'Minimum amount cannot be greater than maximum amount',
      });
    }

    try {
      return await this.prisma.commissionRule.update({
        where: { id },
        data: {
          ...(dto.serviceType !== undefined && {
            serviceType: dto.serviceType,
          }),
          ...(dto.operator !== undefined && {
            operator: dto.operator,
          }),
          ...(dto.role !== undefined && {
            role: dto.role,
          }),
          ...(dto.commissionType !== undefined && {
            commissionType: dto.commissionType,
          }),
          ...(dto.commissionValue !== undefined && {
            commissionValue: dto.commissionValue,
          }),
          ...(dto.minAmount !== undefined && {
            minAmount: dto.minAmount,
          }),
          ...(dto.maxAmount !== undefined && {
            maxAmount: dto.maxAmount,
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
        message: error?.message ?? 'Failed to update commission rule',
      });
    }
  }

  async deleteRule(id: string) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Rule ID is required',
      });
    }

    await this.getRule(id);

    return this.prisma.commissionRule.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
