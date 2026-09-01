import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../database/prisma.service';
import { CreateCommissionRuleDto } from '@nexus/common/commission/dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from '@nexus/common/commission/dto/update-commission-rule.dto';
import { createHash } from 'crypto';

@Injectable()
export class CommissionRuleService {
  constructor(private readonly prisma: PrismaService) {}

  /*
   * =====================================================
   * RPC ERROR
   * =====================================================
   */

  private throwRpc(statusCode: number, message: string): never {
    throw new RpcException({
      statusCode,
      message,
    });
  }

  /*
   * =====================================================
   * NORMALIZATION
   * =====================================================
   *
   * Examples:
   *
   * " vimopay " -> "VIMOPAY"
   * "retailer"   -> "RETAILER"
   */

  private normalizeRequiredCode(value: string, fieldName: string): string {
    const normalized = value?.trim().toUpperCase();

    if (!normalized) {
      this.throwRpc(400, `${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeOptionalCode(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim().toUpperCase();

    return normalized || null;
  }

  /*
   * Amount normalization is important
   * because:
   *
   * 100
   * 100.0
   * 100.00
   *
   * should generate the SAME rule key.
   */

  private normalizeAmountForKey(amount?: number | null): string {
    if (amount === undefined || amount === null) {
      return '*';
    }

    return Number(amount).toFixed(2);
  }

  /*
   * =====================================================
   * DETERMINISTIC RULE KEY
   * =====================================================
   *
   * One unique rule scope:
   *
   * serviceType
   * +
   * operator
   * +
   * role
   * +
   * minAmount
   * +
   * maxAmount
   *
   * Commission value intentionally key ka
   * part nahi hai.
   *
   * ₹10 -> ₹12 update allowed hai.
   */

  private createRuleKey(input: {
    serviceType: string;

    operator?: string | null;

    role: string;

    minAmount?: number | null;

    maxAmount?: number | null;
  }): string {
    const rawKey = [
      this.normalizeRequiredCode(input.serviceType, 'Service type'),

      this.normalizeOptionalCode(input.operator) ?? '*',

      this.normalizeRequiredCode(input.role, 'Role'),

      this.normalizeAmountForKey(input.minAmount),

      this.normalizeAmountForKey(input.maxAmount),
    ].join('|');

    return createHash('sha256').update(rawKey).digest('hex');
  }

  /*
   * =====================================================
   * COMMON VALIDATION
   * =====================================================
   */

  private validateAmounts(input: {
    commissionType: 'FIXED' | 'PERCENTAGE';

    commissionValue: number;

    minAmount?: number | null;

    maxAmount?: number | null;
  }) {
    if (
      typeof input.commissionValue !== 'number' ||
      !Number.isFinite(input.commissionValue) ||
      input.commissionValue < 0
    ) {
      this.throwRpc(400, 'Commission value cannot be negative');
    }

    /*
     * Percentage commission >100%
     * logically invalid.
     */
    if (input.commissionType === 'PERCENTAGE' && input.commissionValue > 100) {
      this.throwRpc(400, 'Percentage commission cannot exceed 100%');
    }

    if (
      input.minAmount !== undefined &&
      input.minAmount !== null &&
      (typeof input.minAmount !== 'number' ||
        !Number.isFinite(input.minAmount) ||
        input.minAmount < 0)
    ) {
      this.throwRpc(400, 'Minimum amount cannot be negative');
    }

    if (
      input.maxAmount !== undefined &&
      input.maxAmount !== null &&
      (typeof input.maxAmount !== 'number' ||
        !Number.isFinite(input.maxAmount) ||
        input.maxAmount < 0)
    ) {
      this.throwRpc(400, 'Maximum amount cannot be negative');
    }

    if (
      input.minAmount !== undefined &&
      input.minAmount !== null &&
      input.maxAmount !== undefined &&
      input.maxAmount !== null &&
      input.minAmount > input.maxAmount
    ) {
      this.throwRpc(
        400,
        'Minimum amount cannot be greater than maximum amount',
      );
    }
  }

  /*
   * =====================================================
   * CREATE RULE
   * =====================================================
   */

  async createRule(dto: CreateCommissionRuleDto) {
    const serviceType = this.normalizeRequiredCode(
      dto.serviceType,
      'Service type',
    );

    const role = this.normalizeRequiredCode(dto.role, 'Role');

    const operator = this.normalizeOptionalCode(dto.operator);

    this.validateAmounts({
      commissionType: dto.commissionType,

      commissionValue: dto.commissionValue,

      minAmount: dto.minAmount,

      maxAmount: dto.maxAmount,
    });

    /*
     * Deterministic identity.
     */
    const ruleKey = this.createRuleKey({
      serviceType,

      operator,

      role,

      minAmount: dto.minAmount,

      maxAmount: dto.maxAmount,
    });

    /*
     * Fast duplicate check.
     *
     * DB unique constraint is still the
     * ultimate concurrent protection.
     */
    const existing = await this.prisma.commissionRule.findUnique({
      where: {
        ruleKey,
      },
    });

    if (existing) {
      if (!existing.isActive) {
        this.throwRpc(
          409,
          `An inactive commission rule already exists for this service, operator, role and amount slab. Update/reactivate rule ${existing.id} instead of creating a duplicate.`,
        );
      }

      this.throwRpc(
        409,
        `Commission rule already exists for this service, operator, role and amount slab. Existing rule: ${existing.id}`,
      );
    }

    try {
      return await this.prisma.commissionRule.create({
        data: {
          ruleKey,

          serviceType,

          operator,

          role,

          commissionType: dto.commissionType,

          commissionValue: dto.commissionValue,

          minAmount: dto.minAmount ?? null,

          maxAmount: dto.maxAmount ?? null,

          priority: dto.priority ?? 0,

          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: any) {
      /*
       * Concurrent requests:
       *
       * Request A + Request B
       * same time duplicate pre-check
       * pass kar sakti hain.
       *
       * ruleKey UNIQUE final protection.
       */
      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.commissionRule.findUnique({
          where: {
            ruleKey,
          },
        });

        this.throwRpc(
          409,
          duplicate
            ? `Commission rule already exists. Existing rule: ${duplicate.id}`
            : 'Commission rule already exists',
        );
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Failed to create commission rule',
      });
    }
  }

  /*
   * =====================================================
   * LIST RULES
   * =====================================================
   */

  async getRules() {
    return this.prisma.commissionRule.findMany({
      orderBy: [
        {
          serviceType: 'asc',
        },

        {
          role: 'asc',
        },

        {
          priority: 'desc',
        },

        {
          createdAt: 'asc',
        },
      ],
    });
  }

  /*
   * =====================================================
   * GET SINGLE
   * =====================================================
   */

  async getRule(id: string) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Rule ID is required');
    }

    const rule = await this.prisma.commissionRule.findUnique({
      where: {
        id,
      },
    });

    if (!rule) {
      this.throwRpc(404, 'Commission rule not found');
    }

    return rule;
  }

  /*
   * =====================================================
   * UPDATE RULE
   * =====================================================
   */

  async updateRule(id: string, dto: UpdateCommissionRuleDto) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Rule ID is required');
    }

    const existing = await this.getRule(id);

    /*
     * Final scope values calculate karo.
     */

    const serviceType =
      dto.serviceType !== undefined
        ? this.normalizeRequiredCode(dto.serviceType, 'Service type')
        : this.normalizeRequiredCode(existing.serviceType, 'Service type');

    const role =
      dto.role !== undefined
        ? this.normalizeRequiredCode(dto.role, 'Role')
        : this.normalizeRequiredCode(existing.role, 'Role');

    /*
     * undefined = keep existing
     * null      = explicitly clear operator
     */
    const operator =
      dto.operator !== undefined
        ? this.normalizeOptionalCode(dto.operator)
        : this.normalizeOptionalCode(existing.operator);

    const commissionType = dto.commissionType ?? existing.commissionType;

    const commissionValue =
      dto.commissionValue !== undefined
        ? dto.commissionValue
        : Number(existing.commissionValue);

    /*
     * null explicitly means
     * unbounded.
     */
    const minAmount =
      dto.minAmount !== undefined
        ? dto.minAmount
        : existing.minAmount === null
          ? null
          : Number(existing.minAmount);

    const maxAmount =
      dto.maxAmount !== undefined
        ? dto.maxAmount
        : existing.maxAmount === null
          ? null
          : Number(existing.maxAmount);

    this.validateAmounts({
      commissionType,

      commissionValue,

      minAmount,

      maxAmount,
    });

    /*
     * Scope changed ho ya same,
     * deterministic key recalculate.
     */
    const ruleKey = this.createRuleKey({
      serviceType,

      operator,

      role,

      minAmount,

      maxAmount,
    });

    /*
     * Collision check except current row.
     */
    const conflictingRule = await this.prisma.commissionRule.findUnique({
      where: {
        ruleKey,
      },
    });

    if (conflictingRule && conflictingRule.id !== id) {
      this.throwRpc(
        409,
        `Another commission rule already exists for this service, operator, role and amount slab. Existing rule: ${conflictingRule.id}`,
      );
    }

    try {
      return await this.prisma.commissionRule.update({
        where: {
          id,
        },

        data: {
          /*
           * Always canonical values.
           */
          ruleKey,

          serviceType,

          operator,

          role,

          commissionType,

          commissionValue,

          minAmount,

          maxAmount,

          ...(dto.priority !== undefined
            ? {
                priority: dto.priority,
              }
            : {}),

          ...(dto.isActive !== undefined
            ? {
                isActive: dto.isActive,
              }
            : {}),
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        this.throwRpc(
          409,
          'Another commission rule already exists for this service, operator, role and amount slab',
        );
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Failed to update commission rule',
      });
    }
  }

  /*
   * =====================================================
   * DELETE / DEACTIVATE
   * =====================================================
   *
   * Hard delete nahi.
   *
   * Historical Commission.ruleId relation
   * preserve rahegi.
   */

  async deleteRule(id: string) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Rule ID is required');
    }

    const existing = await this.getRule(id);

    /*
     * Idempotent delete.
     */
    if (!existing.isActive) {
      return existing;
    }

    return this.prisma.commissionRule.update({
      where: {
        id,
      },

      data: {
        isActive: false,
      },
    });
  }
}
