import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { createHash } from 'crypto';

import { PrismaService } from '../database/prisma.service';

import { CreateCommissionDistributionDto } from '@nexus/common/commission/dto/create-commission-distribution.dto';

import { UpdateCommissionDistributionDto } from '@nexus/common/commission/dto/update-commission-distribution.dto';
import { CommissionRoleValidationService } from './commission-role-validation.service';

@Injectable()
export class CommissionDistributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleValidationService: CommissionRoleValidationService,
  ) {}

  private throwRpc(statusCode: number, message: string): never {
    throw new RpcException({
      statusCode,
      message,
    });
  }

  /*
   * =====================================================
   * NORMALIZE ROLE
   * =====================================================
   *
   * distributor
   * DISTRIBUTOR
   * " DISTRIBUTOR "
   *
   * all same role.
   */

  private normalizeRole(role: string): string {
    const normalized = role?.trim().toUpperCase();

    if (!normalized) {
      this.throwRpc(400, 'Recipient role is required');
    }

    return normalized;
  }

  /*
   * =====================================================
   * DISTRIBUTION IDENTITY
   * =====================================================
   *
   * ONE RULE
   * +
   * ONE RECIPIENT ROLE
   *
   * = ONE distribution configuration
   *
   * Different roles still allow unlimited
   * dynamic distributions.
   */

  private createDistributionKey(
    commissionRuleId: string,
    recipientRole: string,
  ): string {
    return createHash('sha256')
      .update(
        [commissionRuleId.trim(), this.normalizeRole(recipientRole)].join('|'),
      )
      .digest('hex');
  }

  private validateDistribution(
    distributionType: 'FIXED' | 'PERCENTAGE',

    distributionValue: number,
  ) {
    if (
      typeof distributionValue !== 'number' ||
      !Number.isFinite(distributionValue) ||
      distributionValue < 0
    ) {
      this.throwRpc(
        400,
        'Distribution value must be greater than or equal to 0',
      );
    }

    if (distributionType === 'PERCENTAGE' && distributionValue > 100) {
      this.throwRpc(400, 'Percentage distribution cannot exceed 100%');
    }
  }

  /*
   * =====================================================
   * CREATE
   * =====================================================
   */

  async createDistribution(dto: CreateCommissionDistributionDto) {
    /*
     * =====================================================
     * 1. BASIC VALIDATION
     * =====================================================
     */

    if (!dto.commissionRuleId?.trim()) {
      this.throwRpc(400, 'Commission rule ID is required');
    }

    const recipientRole = this.normalizeRole(dto.recipientRole);

    this.validateDistribution(dto.distributionType, dto.distributionValue);

    /*
     * =====================================================
     * 2. ROLE VALIDATION
     * =====================================================
     */

    console.log('[DIST] BEFORE ROLE VALIDATION', recipientRole);

    await this.roleValidationService.assertActiveRole(recipientRole);

    console.log('[DIST] ROLE VALIDATION SUCCESS', recipientRole);

    /*
     * =====================================================
     * 3. COMMISSION RULE LOOKUP
     * =====================================================
     */

    console.log('[DIST] BEFORE RULE LOOKUP', dto.commissionRuleId);

    let rule;

    try {
      rule = await this.prisma.commissionRule.findUnique({
        where: {
          id: dto.commissionRuleId,
        },
      });
    } catch (error) {
      console.error('[DIST] RULE LOOKUP FAILED', error);

      throw new RpcException({
        statusCode: 500,
        message:
          error instanceof Error
            ? error.message
            : 'Commission rule lookup failed',
      });
    }

    console.log(
      '[DIST] RULE LOOKUP RESULT',
      rule
        ? {
            id: rule.id,
            serviceType: rule.serviceType,
            operator: rule.operator,
            role: rule.role,
            isActive: rule.isActive,
          }
        : null,
    );

    if (!rule) {
      this.throwRpc(404, 'Commission rule not found');
    }

    if (!rule.isActive) {
      this.throwRpc(409, 'Commission rule is inactive');
    }

    /*
     * =====================================================
     * 4. DISTRIBUTION UNIQUE KEY
     * =====================================================
     */

    const distributionKey = this.createDistributionKey(rule.id, recipientRole);

    /*
     * =====================================================
     * 5. DUPLICATE CHECK
     * =====================================================
     *
     * distributionKey already represents:
     *
     * ruleId + recipientRole
     *
     * so findUnique is enough.
     */

    console.log('[DIST] BEFORE DUPLICATE CHECK', {
      commissionRuleId: rule.id,

      recipientRole,

      distributionKey,
    });

    let existing;

    try {
      existing = await this.prisma.commissionDistribution.findUnique({
        where: {
          distributionKey,
        },
      });
    } catch (error) {
      console.error('[DIST] DUPLICATE CHECK FAILED', error);

      throw new RpcException({
        statusCode: 500,
        message:
          error instanceof Error
            ? error.message
            : 'Commission distribution lookup failed',
      });
    }

    console.log(
      '[DIST] DUPLICATE CHECK RESULT',
      existing
        ? {
            id: existing.id,

            recipientRole: existing.recipientRole,

            isActive: existing.isActive,
          }
        : null,
    );

    /*
     * Existing active distribution.
     */
    if (existing && existing.isActive) {
      this.throwRpc(
        409,
        `Commission distribution already exists for role ${recipientRole}. Existing distribution: ${existing.id}`,
      );
    }

    /*
     * Existing inactive distribution:
     *
     * new row create nahi karenge.
     * Same configuration reactivate/update.
     */
    if (existing && !existing.isActive) {
      console.log('[DIST] REACTIVATING EXISTING DISTRIBUTION', existing.id);

      try {
        const reactivated = await this.prisma.commissionDistribution.update({
          where: {
            id: existing.id,
          },

          data: {
            recipientRole,

            distributionType: dto.distributionType,

            distributionValue: dto.distributionValue,

            priority: dto.priority ?? existing.priority,

            isActive: dto.isActive ?? true,
          },
        });

        console.log('[DIST] DISTRIBUTION REACTIVATED', {
          id: reactivated.id,

          recipientRole: reactivated.recipientRole,
        });

        return reactivated;
      } catch (error: any) {
        console.error('[DIST] REACTIVATION FAILED', error);

        throw new RpcException({
          statusCode: 500,
          message:
            error?.message ?? 'Unable to reactivate commission distribution',
        });
      }
    }

    /*
     * =====================================================
     * 6. CREATE NEW DISTRIBUTION
     * =====================================================
     */

    console.log('[DIST] BEFORE DB CREATE', {
      commissionRuleId: rule.id,

      recipientRole,

      distributionType: dto.distributionType,

      distributionValue: dto.distributionValue,

      priority: dto.priority ?? 0,

      isActive: dto.isActive ?? true,
    });

    try {
      const created = await this.prisma.commissionDistribution.create({
        data: {
          distributionKey,

          commissionRuleId: rule.id,

          recipientRole,

          distributionType: dto.distributionType,

          distributionValue: dto.distributionValue,

          priority: dto.priority ?? 0,

          isActive: dto.isActive ?? true,
        },
      });

      console.log('[DIST] DB CREATE SUCCESS', {
        id: created.id,

        commissionRuleId: created.commissionRuleId,

        recipientRole: created.recipientRole,

        distributionType: created.distributionType,

        distributionValue: created.distributionValue.toString(),
      });

      return created;
    } catch (error: any) {
      console.error('[DIST] DB CREATE FAILED', error);

      /*
       * Concurrent duplicate.
       */
      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.commissionDistribution.findUnique({
          where: {
            distributionKey,
          },
        });

        this.throwRpc(
          409,
          duplicate
            ? `Commission distribution already exists. Existing distribution: ${duplicate.id}`
            : 'Commission distribution already exists',
        );
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Failed to create commission distribution',
      });
    }
  }

  /*
   * =====================================================
   * LIST
   * =====================================================
   */

  async getDistributions(commissionRuleId?: string) {
    return this.prisma.commissionDistribution.findMany({
      where: commissionRuleId
        ? {
            commissionRuleId,
          }
        : undefined,

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

  /*
   * =====================================================
   * GET SINGLE
   * =====================================================
   */

  async getDistribution(id: string) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Distribution ID is required');
    }

    const distribution = await this.prisma.commissionDistribution.findUnique({
      where: {
        id,
      },
    });

    if (!distribution) {
      this.throwRpc(404, 'Commission distribution not found');
    }

    return distribution;
  }

  /*
   * =====================================================
   * UPDATE
   * =====================================================
   */

  async updateDistribution(
    id: string,

    dto: UpdateCommissionDistributionDto,
  ) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Distribution ID is required');
    }

    const existing = await this.getDistribution(id);

    const recipientRole =
      dto.recipientRole !== undefined
        ? this.normalizeRole(dto.recipientRole)
        : existing.recipientRole;
    const targetIsActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;
    /*
     * Active distribution ka target role
     * active hona mandatory.
     *
     * Inactive distribution ko deactivate
     * karne ke liye inactive role validation
     * blocker nahi banegi.
     */

    if (targetIsActive) {
      await this.roleValidationService.assertActiveRole(recipientRole);
    }

    const distributionType = dto.distributionType ?? existing.distributionType;

    const distributionValue =
      dto.distributionValue !== undefined
        ? dto.distributionValue
        : Number(existing.distributionValue);

    this.validateDistribution(
      distributionType,

      distributionValue,
    );

    /*
     * If recipient role changes,
     * unique identity changes too.
     */

    const distributionKey = this.createDistributionKey(
      existing.commissionRuleId,

      recipientRole,
    );

    const conflicting = await this.prisma.commissionDistribution.findUnique({
      where: {
        distributionKey,
      },
    });

    if (conflicting && conflicting.id !== id) {
      this.throwRpc(
        409,
        `Another commission distribution already exists for role ${recipientRole}. Existing distribution: ${conflicting.id}`,
      );
    }

    try {
      return await this.prisma.commissionDistribution.update({
        where: {
          id,
        },

        data: {
          distributionKey,

          recipientRole,

          distributionType,

          distributionValue,

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
          `Another distribution already exists for role ${recipientRole}`,
        );
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Failed to update commission distribution',
      });
    }
  }

  /*
   * =====================================================
   * DELETE / DEACTIVATE
   * =====================================================
   */

  async deleteDistribution(id: string) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Distribution ID is required');
    }

    const existing = await this.getDistribution(id);

    /*
     * Idempotent soft delete.
     */
    if (!existing.isActive) {
      return existing;
    }

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
