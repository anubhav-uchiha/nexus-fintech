import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RpcException } from '@nestjs/microservices';
import { CalculateCommissionDto } from '@nexus/common/commission/dto/calculate-commission.dto';
import { CreateProviderCommissionDto } from '@nexus/common/commission/dto/create-provider-commission.dto';
import { FinalizeProviderCommissionDto } from '@nexus/common/commission/dto/finalize-provider-commission.dto';
import { CommissionHierarchyService } from './commission-hierarchy.service';
import { CommissionRoleValidationService } from './commission-role-validation.service';

@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionHierarchyService: CommissionHierarchyService,
    private readonly roleValidationService: CommissionRoleValidationService,
  ) {}

  private throwRpc(statusCode: number, message: string): never {
    throw new RpcException({
      statusCode,
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
        statusCode: 500,
        message: error?.message ?? 'Commission calculation failed',
      });
    }
  }

  private async resolveCommissionRule(
    serviceType: string,
    role: string,
    transactionAmount: number,
    operator?: string,
  ) {
    const rules = await this.prisma.commissionRule.findMany({
      where: {
        serviceType,
        role,
        isActive: true,

        OR: [
          ...(operator
            ? [
                {
                  operator,
                },
              ]
            : []),

          {
            operator: null,
          },
        ],
      },

      orderBy: [
        {
          priority: 'desc',
        },

        {
          createdAt: 'asc',
        },
      ],
    });

    const amountMatches = (item: (typeof rules)[number]) => {
      const minValid =
        item.minAmount === null || transactionAmount >= Number(item.minAmount);

      const maxValid =
        item.maxAmount === null || transactionAmount <= Number(item.maxAmount);

      return minValid && maxValid;
    };

    /*
     * Provider-specific rule first.
     */
    if (operator) {
      const exactRule = rules.find(
        (item) => item.operator === operator && amountMatches(item),
      );

      if (exactRule) {
        return exactRule;
      }
    }

    /*
     * Then generic rule.
     */
    return (
      rules.find((item) => item.operator === null && amountMatches(item)) ??
      null
    );
  }

  async createProviderCommission(dto: CreateProviderCommissionDto) {
    /*
     * =====================================================
     * 1. VALIDATION
     * =====================================================
     */

    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    if (!dto.role?.trim()) {
      this.throwRpc(400, 'Role is required');
    }

    if (!dto.serviceType?.trim()) {
      this.throwRpc(400, 'Service type is required');
    }

    if (!Number.isFinite(dto.transactionAmount) || dto.transactionAmount <= 0) {
      this.throwRpc(400, 'Transaction amount must be greater than 0');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
    }

    /*
     * =====================================================
     * 2. DUPLICATE CHECK
     * =====================================================
     *
     * Existing commission ke saath allocations
     * bhi return honi chahiye.
     */

    const existing = await this.prisma.commission.findUnique({
      where: {
        idempotencyKey: dto.idempotencyKey,
      },

      include: {
        distributionTransactions: true,
      },
    });

    if (existing) {
      const existingGrossAmount = Number(existing.transactionAmount);

      const existingCommissionAmount = Number(existing.commissionAmount);

      const existingNetAmount = Number(
        (existingGrossAmount - existingCommissionAmount).toFixed(2),
      );

      return {
        ...existing,

        transactionAmount: existing.transactionAmount.toString(),

        commissionAmount: existing.commissionAmount.toString(),

        grossAmount: existingGrossAmount.toFixed(2),

        netAmount: existingNetAmount.toFixed(2),

        commissionRequired: true,

        duplicate: true,

        allocations: existing.distributionTransactions.map((item) => ({
          id: item.id,

          distributionId: item.distributionId,

          recipientUserId: item.recipientUserId,

          recipientRole: item.recipientRole,

          amount: item.amount.toString(),

          walletType: item.walletType,

          status: item.status,

          transactionId: item.transactionId,

          transactionReference: item.transactionReference,

          idempotencyKey: item.idempotencyKey,

          failureReason: item.failureReason,

          creditedAt: item.creditedAt,

          isSource: item.recipientUserId === dto.userId,
        })),
      };
    }

    /*
     * =====================================================
     * 3. RESOLVE COMMISSION RULE
     * =====================================================
     */

    console.log('[COMMISSION] CREATE START', {
      userId: dto.userId,
      role: dto.role,
      serviceType: dto.serviceType,
      operator: dto.operator,
      amount: dto.transactionAmount,
      providerTransactionReference: dto.providerTransactionReference,
    });

    const rule = await this.resolveCommissionRule(
      dto.serviceType,
      dto.role,
      dto.transactionAmount,
      dto.operator,
    );

    console.log(
      '[COMMISSION] RULE RESULT',
      rule
        ? {
            id: rule.id,
            serviceType: rule.serviceType,
            role: rule.role,
            operator: rule.operator,
            commissionValue: rule.commissionValue.toString(),
          }
        : null,
    );

    /*
     * No configured rule:
     * commission nahi lagegi.
     */
    if (!rule) {
      return {
        commissionRequired: false,

        grossAmount: dto.transactionAmount.toFixed(2),

        commissionAmount: '0.00',

        netAmount: dto.transactionAmount.toFixed(2),

        reason: 'NO_COMMISSION_RULE',
      };
    }

    /*
     * =====================================================
     * 4. TOTAL COMMISSION POOL
     * =====================================================
     */

    const commissionAmount = this.calculateCommissionAmount(
      dto.transactionAmount,

      rule.commissionType,

      Number(rule.commissionValue),
    );

    if (commissionAmount <= 0) {
      return {
        commissionRequired: false,

        grossAmount: dto.transactionAmount.toFixed(2),

        commissionAmount: '0.00',

        netAmount: dto.transactionAmount.toFixed(2),

        reason: 'ZERO_COMMISSION',
      };
    }

    /*
     * Commission gross amount ke equal
     * ya usse greater nahi ho sakti.
     *
     * Example:
     * gross = 150
     * commission = 150 ❌
     */
    if (commissionAmount >= dto.transactionAmount) {
      this.throwRpc(409, 'Commission must be less than transaction amount');
    }

    /*
     * New business model:
     *
     * GROSS - COMMISSION = NET PRINCIPAL
     *
     * Example:
     * 150 - 10 = 140
     */

    const netAmount = Number(
      (dto.transactionAmount - commissionAmount).toFixed(2),
    );

    /*
     * =====================================================
     * 5. BUILD DISTRIBUTION PLAN
     * =====================================================
     *
     * Example:
     *
     * total commission = 10
     *
     * merchant    = 7
     * distributor = 2
     * super dist  = 1
     */

    console.log('[COMMISSION] BEFORE DISTRIBUTION PLAN', {
      sourceUserId: dto.userId,
      sourceRole: dto.role,
      serviceType: dto.serviceType,
      ruleId: rule.id,
      commissionAmount,
    });

    let allocations;

    try {
      allocations = await this.buildDistributionPlan({
        sourceUserId: dto.userId,

        sourceRole: dto.role,

        serviceType: dto.serviceType,

        ruleId: rule.id,

        commissionAmount,
      });

      console.log('[COMMISSION] DISTRIBUTION PLAN OK', allocations);
    } catch (error) {
      console.error('[COMMISSION] DISTRIBUTION PLAN FAILED', error);

      throw error;
    }

    /*
     * Extra accounting safety.
     *
     * Allocation sum exactly commission pool
     * ke equal honi chahiye.
     */

    const allocatedPaise = allocations.reduce(
      (sum, allocation) => sum + Math.round(allocation.amount * 100),

      0,
    );

    const commissionPaise = Math.round(commissionAmount * 100);

    if (allocatedPaise !== commissionPaise) {
      this.throwRpc(
        409,
        `Commission allocation mismatch. Commission: ₹${commissionAmount.toFixed(
          2,
        )}, allocated: ₹${(allocatedPaise / 100).toFixed(2)}`,
      );
    }

    /*
     * =====================================================
     * 6. COMMISSION + DISTRIBUTIONS ATOMIC CREATE
     * =====================================================
     *
     * Agar distribution creation fail hoti hai,
     * Commission row bhi rollback hogi.
     */
    console.log('[COMMISSION] BEFORE DB CREATE', {
      allocationCount: allocations.length,
      commissionAmount,
    });
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          /*
           * Concurrent duplicate safety.
           */
          const duplicate = await tx.commission.findUnique({
            where: {
              idempotencyKey: dto.idempotencyKey,
            },

            include: {
              distributionTransactions: true,
            },
          });

          if (duplicate) {
            return {
              commission: duplicate,

              distributionTransactions: duplicate.distributionTransactions,

              duplicate: true,
            };
          }

          /*
           * Main commission record.
           */
          const commission = await tx.commission.create({
            data: {
              referenceId: this.generateReference(),

              /*
               * ProviderTransaction UUID.
               */
              transactionId: dto.providerTransactionId,

              transactionReference: dto.providerTransactionReference,

              userId: dto.userId,

              role: dto.role,

              serviceType: dto.serviceType,

              operator: dto.operator,

              /*
               * Gross transaction amount.
               */
              transactionAmount: dto.transactionAmount,

              /*
               * Entire commission pool.
               */
              commissionAmount,

              commissionType: rule.commissionType,

              ruleId: rule.id,

              /*
               * Wallet distributions pending.
               */
              status: 'PENDING',

              idempotencyKey: dto.idempotencyKey,

              metadata: {
                source: 'PROVIDER_TRANSACTION',

                grossAmount: dto.transactionAmount,

                commissionAmount,

                netAmount,
              },
            },
          });

          /*
           * Snapshot all recipients.
           *
           * Future hierarchy/rule changes
           * existing transaction ko affect nahi
           * karenge.
           */
          const distributionTransactions = [];

          for (const allocation of allocations) {
            const item = await tx.commissionDistributionTransaction.create({
              data: {
                commissionId: commission.id,

                distributionId: allocation.distributionId,

                sourceUserId: dto.userId,

                recipientUserId: allocation.recipientUserId,

                recipientRole: allocation.recipientRole,

                amount: allocation.amount,

                walletType: 'PROFIT',

                status: 'PENDING',

                idempotencyKey: `COMM-DIST:${commission.id}:${allocation.distributionId ?? 'SOURCE'}:${allocation.recipientUserId}`,
              },
            });

            distributionTransactions.push(item);
          }

          return {
            commission,

            distributionTransactions,

            duplicate: false,
          };
        },
        {
          isolationLevel: 'Serializable',
        },
      );
      console.log('[COMMISSION] DB CREATE SUCCESS', {
        commissionId: result.commission.id,
        referenceId: result.commission.referenceId,
        allocations: result.distributionTransactions.length,
      });

      /*
       * =====================================================
       * 7. RESPONSE
       * =====================================================
       */

      return {
        ...result.commission,

        transactionAmount: result.commission.transactionAmount.toString(),

        commissionAmount: result.commission.commissionAmount.toString(),

        /*
         * New accounting information.
         */
        grossAmount: dto.transactionAmount.toFixed(2),

        netAmount: netAmount.toFixed(2),

        commissionRequired: true,

        duplicate: result.duplicate,

        allocations: result.distributionTransactions.map((item) => ({
          id: item.id,

          recipientUserId: item.recipientUserId,

          recipientRole: item.recipientRole,

          amount: item.amount.toString(),

          walletType: item.walletType,

          status: item.status,

          isSource: item.recipientUserId === dto.userId,
        })),
      };
    } catch (error: any) {
      /*
       * =====================================================
       * 8. CONCURRENT DUPLICATE
       * =====================================================
       */

      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.commission.findUnique({
          where: {
            idempotencyKey: dto.idempotencyKey,
          },

          include: {
            distributionTransactions: true,
          },
        });

        if (duplicate) {
          const duplicateNetAmount = Number(
            (
              Number(duplicate.transactionAmount) -
              Number(duplicate.commissionAmount)
            ).toFixed(2),
          );

          return {
            ...duplicate,

            transactionAmount: duplicate.transactionAmount.toString(),

            commissionAmount: duplicate.commissionAmount.toString(),

            grossAmount: duplicate.transactionAmount.toString(),

            netAmount: duplicateNetAmount.toFixed(2),

            commissionRequired: true,

            duplicate: true,

            allocations: duplicate.distributionTransactions.map((item) => ({
              id: item.id,

              recipientUserId: item.recipientUserId,

              recipientRole: item.recipientRole,

              amount: item.amount.toString(),

              walletType: item.walletType,

              status: item.status,

              isSource: item.recipientUserId === dto.userId,
            })),
          };
        }
      }

      if (error?.code === 'P2034') {
        throw new RpcException({
          statusCode: 409,

          message: 'Commission creation conflict. Please retry.',
        });
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Provider commission creation failed',
      });
    }
  }

  async finalizeProviderCommission(dto: FinalizeProviderCommissionDto) {
    const commission = await this.prisma.commission.findUnique({
      where: {
        referenceId: dto.commissionReference,
      },
    });

    if (!commission) {
      this.throwRpc(404, 'Commission not found');
    }

    /*
     * Idempotent.
     */
    if (commission.status === 'SUCCESS') {
      return commission;
    }

    if (commission.status !== 'PENDING') {
      this.throwRpc(
        409,
        `Commission cannot be finalized from ${commission.status} state`,
      );
    }

    return this.prisma.commission.update({
      where: {
        id: commission.id,
      },

      data: {
        status: 'SUCCESS',

        walletTransactionId: dto.walletTransactionId,

        walletTransactionReference: dto.walletTransactionReference,

        creditedAt: new Date(),

        failureReason: null,
      },
    });
  }

  async quoteProviderCommission(dto: {
    userId: string;
    role: string;
    serviceType: string;
    operator?: string;
    transactionAmount: number;
  }) {
    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    if (!dto.role?.trim()) {
      this.throwRpc(400, 'Role is required');
    }

    if (!dto.serviceType?.trim()) {
      this.throwRpc(400, 'Service type is required');
    }

    if (!Number.isFinite(dto.transactionAmount) || dto.transactionAmount <= 0) {
      this.throwRpc(400, 'Transaction amount must be greater than 0');
    }

    const rule = await this.resolveCommissionRule(
      dto.serviceType,
      dto.role,
      dto.transactionAmount,
      dto.operator,
    );

    /*
     * No rule:
     * full amount principal rahega.
     */
    if (!rule) {
      return {
        commissionRequired: false,

        grossAmount: dto.transactionAmount.toFixed(2),

        commissionAmount: '0.00',

        netAmount: dto.transactionAmount.toFixed(2),

        ruleId: null,

        reason: 'NO_COMMISSION_RULE',
      };
    }

    const commissionAmount = this.calculateCommissionAmount(
      dto.transactionAmount,
      rule.commissionType,
      Number(rule.commissionValue),
    );

    if (commissionAmount < 0 || commissionAmount >= dto.transactionAmount) {
      this.throwRpc(409, 'Commission must be less than transaction amount');
    }

    const netAmount = Number(
      (dto.transactionAmount - commissionAmount).toFixed(2),
    );

    return {
      commissionRequired: commissionAmount > 0,

      grossAmount: dto.transactionAmount.toFixed(2),

      commissionAmount: commissionAmount.toFixed(2),

      netAmount: netAmount.toFixed(2),

      ruleId: rule.id,

      commissionType: rule.commissionType,

      commissionValue: rule.commissionValue.toString(),

      reason: commissionAmount > 0 ? null : 'ZERO_COMMISSION',
    };
  }

  private async buildDistributionPlan(input: {
    sourceUserId: string;

    sourceRole: string;

    serviceType: string;

    ruleId: string;

    commissionAmount: number;
  }) {
    /*
     * Commission ko paise mein calculate
     * karenge to floating point issues
     * avoid honge.
     */
    const totalPaise = Math.round(input.commissionAmount * 100);

    const distributions = await this.prisma.commissionDistribution.findMany({
      where: {
        commissionRuleId: input.ruleId,

        isActive: true,
      },

      orderBy: [
        {
          priority: 'desc',
        },

        {
          createdAt: 'asc',
        },
      ],
    });
    console.log(
      '[COMMISSION] ACTIVE DISTRIBUTIONS',
      distributions.map((item) => ({
        id: item.id,
        recipientRole: item.recipientRole,
        type: item.distributionType,
        value: item.distributionValue.toString(),
      })),
    );
    /*
     * No distribution config:
     *
     * full commission source merchant.
     */
    if (distributions.length === 0) {
      return [
        {
          distributionId: null,

          recipientUserId: input.sourceUserId,

          recipientRole: input.sourceRole,

          amount: Number((totalPaise / 100).toFixed(2)),

          isSource: true,
        },
      ];
    }

    /*
     * Resolve actual hierarchy.
     */
    const hierarchy =
      await this.commissionHierarchyService.resolveHierarchyForUser(
        input.sourceUserId,

        input.serviceType,
      );
    console.log('[COMMISSION] HIERARCHY RESOLVED', hierarchy);
    /*
     * Resolver source role UNKNOWN deta hai.
     * Trusted role se correct karte hain.
     */
    if (hierarchy.length > 0) {
      hierarchy[0].role = input.sourceRole;
    }

    const allocations: Array<{
      distributionId: string | null;

      recipientUserId: string;

      recipientRole: string;

      amount: number;

      isSource: boolean;
    }> = [];

    let allocatedPaise = 0;

    for (const distribution of distributions) {
      /*
       * Distribution create ke waqt role
       * active tha.
       *
       * Runtime par dobara ensure:
       * role later inactive nahi hua.
       */

      await this.roleValidationService.assertActiveRole(
        distribution.recipientRole,
      );
      /*
       * Role ke corresponding actual
       * user ko hierarchy se resolve karo.
       */
      const recipient = hierarchy.find(
        (item) => item.role === distribution.recipientRole,
      );

      if (!recipient) {
        console.warn('[COMMISSION] DISTRIBUTION SKIPPED', {
          distributionId: distribution.id,

          recipientRole: distribution.recipientRole,

          reason: 'HIERARCHY_RECIPIENT_NOT_FOUND',
        });
        /*
         * No eligible recipient.
         *
         * Distribution allocate nahi hogi.
         * Amount remainder mein source merchant ko
         * automatically chali jayegi.
         */
        continue;
      }
      const eligibility =
        await this.roleValidationService.getRecipientEligibility(
          recipient.userId,
          distribution.recipientRole,
        );

      if (!eligibility.eligible) {
        console.warn('[COMMISSION] DISTRIBUTION SKIPPED', {
          distributionId: distribution.id,

          recipientUserId: recipient.userId,

          recipientRole: distribution.recipientRole,

          reason: eligibility.reason,

          status: eligibility.status,
        });

        /*
         * allocatedPaise increment nahi hoga.
         *
         * Isliye amount automatically
         * source merchant remainder mein jayegi.
         */
        continue;
      }

      let allocationPaise: number;

      if (distribution.distributionType === 'FIXED') {
        allocationPaise = Math.round(
          Number(distribution.distributionValue) * 100,
        );
      } else {
        /*
         * Percentage TOTAL COMMISSION
         * POOL ka hai,
         * gross transaction ka nahi.
         */
        allocationPaise = Math.round(
          (totalPaise * Number(distribution.distributionValue)) / 100,
        );
      }

      if (allocationPaise <= 0) {
        continue;
      }

      if (allocatedPaise + allocationPaise > totalPaise) {
        this.throwRpc(
          409,

          'Commission distributions exceed total commission amount',
        );
      }

      allocatedPaise += allocationPaise;

      allocations.push({
        distributionId: distribution.id,

        recipientUserId: recipient.userId,

        recipientRole: recipient.role,

        amount: Number((allocationPaise / 100).toFixed(2)),

        isSource: recipient.userId === input.sourceUserId,
      });
    }

    /*
     * Remaining commission source
     * merchant ko.
     *
     * Example:
     *
     * total 10
     * distributor 2
     * super distributor 1
     *
     * remainder 7 → merchant.
     */
    const remainderPaise = totalPaise - allocatedPaise;

    if (remainderPaise > 0) {
      allocations.push({
        distributionId: null,

        recipientUserId: input.sourceUserId,

        recipientRole: input.sourceRole,

        amount: Number((remainderPaise / 100).toFixed(2)),

        isSource: true,
      });
    }

    return allocations;
  }

  async getProviderCommissionExecution(commissionReference: string) {
    if (!commissionReference?.trim()) {
      this.throwRpc(400, 'Commission reference is required');
    }

    const commission = await this.prisma.commission.findUnique({
      where: {
        referenceId: commissionReference,
      },

      include: {
        distributionTransactions: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!commission) {
      this.throwRpc(404, 'Commission not found');
    }

    return {
      id: commission.id,

      referenceId: commission.referenceId,

      userId: commission.userId,

      role: commission.role,

      serviceType: commission.serviceType,

      transactionAmount: commission.transactionAmount.toString(),

      commissionAmount: commission.commissionAmount.toString(),

      status: commission.status,

      allocations: commission.distributionTransactions.map((item) => ({
        id: item.id,

        distributionId: item.distributionId,

        sourceUserId: item.sourceUserId,

        recipientUserId: item.recipientUserId,

        recipientRole: item.recipientRole,

        amount: item.amount.toString(),

        walletType: item.walletType,

        status: item.status,

        transactionId: item.transactionId,

        transactionReference: item.transactionReference,

        idempotencyKey: item.idempotencyKey,

        failureReason: item.failureReason,

        creditedAt: item.creditedAt,
      })),
    };
  }

  async markDistributionSuccess(dto: {
    distributionTransactionId: string;

    walletTransactionId: string;

    walletTransactionReference: string;
  }) {
    const allocation =
      await this.prisma.commissionDistributionTransaction.findUnique({
        where: {
          id: dto.distributionTransactionId,
        },
      });

    if (!allocation) {
      this.throwRpc(404, 'Commission distribution transaction not found');
    }

    /*
     * Fully idempotent.
     */
    if (allocation.status === 'SUCCESS') {
      if (
        allocation.transactionReference &&
        allocation.transactionReference !== dto.walletTransactionReference
      ) {
        this.throwRpc(
          409,
          'Commission distribution was already settled using another wallet transaction',
        );
      }

      return allocation;
    }

    if (allocation.status === 'REVERSED') {
      this.throwRpc(
        409,
        'Reversed commission distribution cannot be settled again',
      );
    }

    return this.prisma.commissionDistributionTransaction.update({
      where: {
        id: allocation.id,
      },

      data: {
        status: 'SUCCESS',

        transactionId: dto.walletTransactionId,

        transactionReference: dto.walletTransactionReference,

        creditedAt: new Date(),

        failureReason: null,
      },
    });
  }

  async markDistributionFailed(dto: {
    distributionTransactionId: string;

    reason: string;
  }) {
    const allocation =
      await this.prisma.commissionDistributionTransaction.findUnique({
        where: {
          id: dto.distributionTransactionId,
        },
      });

    if (!allocation) {
      this.throwRpc(404, 'Commission distribution transaction not found');
    }

    /*
     * Already SUCCESS ko FAILED
     * par downgrade nahi karna.
     */
    if (allocation.status === 'SUCCESS') {
      return allocation;
    }

    if (allocation.status === 'REVERSED') {
      return allocation;
    }

    return this.prisma.commissionDistributionTransaction.update({
      where: {
        id: allocation.id,
      },

      data: {
        status: 'FAILED',

        failureReason: dto.reason.trim().slice(0, 500),
      },
    });
  }

  async finalizeProviderDistributions(commissionReference: string) {
    const commission = await this.prisma.commission.findUnique({
      where: {
        referenceId: commissionReference,
      },

      include: {
        distributionTransactions: true,
      },
    });

    if (!commission) {
      this.throwRpc(404, 'Commission not found');
    }

    /*
     * Already complete.
     */
    if (commission.status === 'SUCCESS') {
      return {
        status: 'SUCCESS',

        commissionReference: commission.referenceId,

        commissionAmount: commission.commissionAmount.toString(),

        totalAllocations: commission.distributionTransactions.length,

        successfulAllocations: commission.distributionTransactions.length,

        pendingAllocations: 0,

        failedAllocations: 0,
      };
    }

    const allocations = commission.distributionTransactions;

    if (allocations.length === 0) {
      this.throwRpc(409, 'Commission has no distribution allocations');
    }

    /*
     * ===================================================
     * MONEY CONSERVATION CHECK
     * ===================================================
     */

    const commissionPaise = Math.round(
      Number(commission.commissionAmount) * 100,
    );

    const allocatedPaise = allocations.reduce(
      (sum, item) => sum + Math.round(Number(item.amount) * 100),

      0,
    );

    if (allocatedPaise !== commissionPaise) {
      this.throwRpc(
        409,

        `Commission allocation mismatch. Commission: ₹${(
          commissionPaise / 100
        ).toFixed(2)}, allocations: ₹${(allocatedPaise / 100).toFixed(2)}`,
      );
    }

    const success = allocations.filter((item) => item.status === 'SUCCESS');

    const failed = allocations.filter((item) => item.status === 'FAILED');

    const pending = allocations.filter((item) => item.status === 'PENDING');

    /*
     * At least one distribution unfinished.
     */
    if (success.length !== allocations.length) {
      await this.prisma.commission.update({
        where: {
          id: commission.id,
        },

        data: {
          status: 'PENDING',

          failureReason:
            failed.length > 0
              ? `${failed.length} commission distribution(s) failed or require retry`
              : null,
        },
      });

      return {
        status: 'PENDING',

        commissionReference: commission.referenceId,

        commissionAmount: commission.commissionAmount.toString(),

        totalAllocations: allocations.length,

        successfulAllocations: success.length,

        pendingAllocations: pending.length,

        failedAllocations: failed.length,
      };
    }

    /*
     * ===================================================
     * ALL DISTRIBUTIONS SUCCESS
     * ===================================================
     */

    const now = new Date();

    /*
     * Legacy single wallet ref fields:
     *
     * exactly one allocation ho to populate.
     *
     * Multiple distributions mein intentionally
     * null rahenge because ek single wallet txn
     * poore commission ko represent nahi karti.
     */
    const onlyAllocation = allocations.length === 1 ? allocations[0] : null;

    await this.prisma.commission.update({
      where: {
        id: commission.id,
      },

      data: {
        status: 'SUCCESS',

        creditedAt: now,

        failureReason: null,

        walletTransactionId: onlyAllocation?.transactionId ?? null,

        walletTransactionReference:
          onlyAllocation?.transactionReference ?? null,
      },
    });

    return {
      status: 'SUCCESS',

      commissionReference: commission.referenceId,

      commissionAmount: commission.commissionAmount.toString(),

      totalAllocations: allocations.length,

      successfulAllocations: allocations.length,

      pendingAllocations: 0,

      failedAllocations: 0,
    };
  }

  async cancelProviderCommission(commissionReference: string, reason: string) {
    if (!commissionReference?.trim()) {
      this.throwRpc(400, 'Commission reference is required');
    }

    if (!reason?.trim()) {
      this.throwRpc(400, 'Commission cancellation reason is required');
    }

    const commission = await this.prisma.commission.findUnique({
      where: {
        referenceId: commissionReference,
      },

      include: {
        distributionTransactions: true,
      },
    });

    if (!commission) {
      this.throwRpc(404, 'Commission not found');
    }

    /*
     * Already cancelled.
     */
    if (commission.status === 'FAILED') {
      return commission;
    }

    if (commission.status === 'REVERSED') {
      return commission;
    }

    /*
     * Any wallet allocation already credited?
     *
     * Then simple cancel forbidden.
     * Actual reversal required.
     */
    const successfulAllocation = commission.distributionTransactions.find(
      (item) => item.status === 'SUCCESS',
    );

    if (successfulAllocation || commission.status === 'SUCCESS') {
      this.throwRpc(
        409,
        'Commission already has successful wallet distributions and must be reversed instead of cancelled',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.commissionDistributionTransaction.updateMany({
        where: {
          commissionId: commission.id,

          status: {
            in: ['PENDING', 'FAILED'],
          },
        },

        data: {
          status: 'FAILED',

          failureReason: reason.trim().slice(0, 500),
        },
      });

      return tx.commission.update({
        where: {
          id: commission.id,
        },

        data: {
          status: 'FAILED',

          failureReason: reason.trim().slice(0, 500),
        },
      });
    });
  }
}
