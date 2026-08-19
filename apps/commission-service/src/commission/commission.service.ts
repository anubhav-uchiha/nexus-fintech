import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RpcException } from '@nestjs/microservices';
import { CalculateCommissionDto } from '@nexus/common/commission/dto/calculate-commission.dto';

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  private throwRpc(status: number, message: string): never {
    throw new RpcException({
      status,
      message,
    });
  }

  private generateReference(prefix = 'COMM'): string {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
  }

  private calculateCommissionAmount(
    amount: number,
    commissionType: 'FIXED' | 'PERCENTAGE',
    commisisonValue: number,
  ): number {
    let commission: number = 0;

    if (commissionType === 'FIXED') {
      commission = commisisonValue;
    } else if (commissionType === 'PERCENTAGE') {
      commission = (amount * commisisonValue) / 100;
    }
    return Number(commission.toFixed(2));
  }

  async calculateCommission(dto: CalculateCommissionDto) {
    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    if (!dto.role?.trim()) {
      this.throwRpc(400, 'Role is required');
    }

    if (!dto.serviceType?.trim()) {
      this.throwRpc(400, 'Service type is required');
    }

    if (
      typeof dto.transactionAmount !== 'number' ||
      !Number.isFinite(dto.transactionAmount) ||
      dto.transactionAmount < 0.01
    ) {
      this.throwRpc(400, 'Transaction amount must be greater than 0');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
    }

    if (dto.transactionId) {
      const existingCommission = await this.prisma.commission.findUnique({
        where: {
          idempotencyKey: dto.idempotencyKey,
        },
      });

      if (existingCommission) {
        return existingCommission;
      }
    }

    const rules = await this.prisma.commissionRule.findMany({
      where: {
        serviceType: dto.serviceType,
        role: dto.role,
        isActive: true,

        OR: [
          {
            operator: dto.operator ?? null,
          },
          {
            operator: null,
          },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    const rule = rules.find((item) => {
      const minValid =
        item.minAmount === null ||
        dto.transactionAmount >= Number(item.minAmount);

      const maxValid =
        item.maxAmount === null ||
        dto.transactionAmount <= Number(item.maxAmount);

      return minValid && maxValid;
    });

    if (!rule) {
      this.throwRpc(
        404,
        `No commission rule found for service ${dto.serviceType},role ${dto.role}`,
      );
    }
    const commissionAmount = this.calculateCommissionAmount(
      dto.transactionAmount,
      rule.commissionType,
      Number(rule.commissionValue),
    );
    if (!dto.transactionId) {
      return {
        commissionAmount,
        commissionType: rule.commissionType,
        ruleId: rule.id,
        serviceType: dto.serviceType,
        role: dto.role,
      };
    }
    try {
      const commission = await this.prisma.commission.create({
        data: {
          referenceId: this.generateReference(),
          transactionId: dto.transactionId,
          transactionReference: dto.transactionReference,
          userId: dto.userId,
          role: dto.role,
          serviceType: dto.serviceType,
          operator: dto.operator,
          transactionAmount: dto.transactionAmount,
          commissionAmount,
          commissionType: rule.commissionType,
          ruleId: rule.id,
          status: 'SUCCESS',
          idempotencyKey: dto.idempotencyKey,
        },
      });
      return commission;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await this.prisma.commission.findUnique({
          where: {
            idempotencyKey: dto.idempotencyKey,
          },
        });
        if (existing) {
          return existing;
        }
        this.throwRpc(409, 'Commission already exists');
      }
      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Commission calculation failed',
      });
    }
  }
}
