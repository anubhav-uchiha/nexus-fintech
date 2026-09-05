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

    const grossAmount = Number(dto.transactionAmount.toFixed(2));

    /*
     * =====================================================
     * PROVIDER FUNDED?
     * =====================================================
     */

    const providerFunded = dto.commissionAmountSource === 'PROVIDER';

    console.log('[COMMISSION] CREATE START', {
      userId: dto.userId,

      role: dto.role,

      serviceType: dto.serviceType,

      operator: dto.operator,

      transactionAmount: grossAmount,

      providerCommissionAmount: dto.providerCommissionAmount,

      commissionAmountSource: dto.commissionAmountSource,

      providerIncomeSource: dto.providerIncomeSource,

      providerTransactionReference: dto.providerTransactionReference,
    });

    /*
     * =====================================================
     * 2. DUPLICATE
     * =====================================================
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
      const existingGross = Number(existing.transactionAmount);

      const existingCommission = Number(existing.commissionAmount);

      const metadata =
        existing.metadata &&
        typeof existing.metadata === 'object' &&
        !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};

      const existingProviderFunded =
        metadata.commissionAmountSource === 'PROVIDER';

      /*
       * Provider income principal ko
       * reduce nahi karti.
       */
      const existingNet = existingProviderFunded
        ? existingGross
        : Number((existingGross - existingCommission).toFixed(2));

      if (
        dto.providerTransactionId &&
        existing.transactionId !== dto.providerTransactionId
      ) {
        this.throwRpc(
          409,
          'Commission idempotency key belongs to another provider transaction',
        );
      }

      if (
        dto.providerTransactionReference &&
        existing.transactionReference &&
        existing.transactionReference !== dto.providerTransactionReference
      ) {
        this.throwRpc(
          409,
          'Commission idempotency key belongs to another provider transaction reference',
        );
      }

      if (
        existing.userId !== dto.userId ||
        existing.role !== dto.role ||
        existing.serviceType !== dto.serviceType
      ) {
        this.throwRpc(
          409,
          'Commission idempotency key was already used with different commission details',
        );
      }

      /*
       * Provider-funded retries MUST contain
       * exactly same provider income amount.
       */
      if (providerFunded) {
        const requestedIncome = Number(dto.providerCommissionAmount);

        if (!Number.isFinite(requestedIncome) || requestedIncome < 0) {
          this.throwRpc(400, 'Provider commission amount is invalid');
        }

        if (
          Math.round(requestedIncome * 100) !==
          Math.round(Number(existing.commissionAmount) * 100)
        ) {
          this.throwRpc(
            409,
            `Provider income mismatch for existing commission. Existing: ₹${Number(
              existing.commissionAmount,
            ).toFixed(2)}, requested: ₹${requestedIncome.toFixed(2)}`,
          );
        }

        const existingMetadata =
          existing.metadata &&
          typeof existing.metadata === 'object' &&
          !Array.isArray(existing.metadata)
            ? (existing.metadata as Record<string, unknown>)
            : {};

        if (existingMetadata.commissionAmountSource !== 'PROVIDER') {
          this.throwRpc(
            409,
            'Existing commission was not created from provider income',
          );
        }

        const existingIncomeSource =
          typeof existingMetadata.providerIncomeSource === 'string'
            ? existingMetadata.providerIncomeSource
            : null;

        if (
          dto.providerIncomeSource &&
          existingIncomeSource &&
          dto.providerIncomeSource !== existingIncomeSource
        ) {
          this.throwRpc(
            409,
            'Provider income source does not match existing commission',
          );
        }
      }

      return {
        ...existing,

        transactionAmount: existing.transactionAmount.toString(),

        commissionAmount: existing.commissionAmount.toString(),

        grossAmount: existingGross.toFixed(2),

        netAmount: existingNet.toFixed(2),

        commissionRequired: existingCommission > 0,

        amountSource: existingProviderFunded ? 'PROVIDER' : 'RULE',

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
     * 3. RULE / DISTRIBUTION PROFILE
     * =====================================================
     *
     * IMPORTANT:
     *
     * VimoPay case mein rule ki
     * commissionValue actual commission
     * calculate nahi karegi.
     *
     * Rule sirf distributions locate
     * karne ke liye use hogi.
     */

    const rule = await this.resolveCommissionRule(
      dto.serviceType,
      dto.role,
      grossAmount,
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

            /*
             * Sirf debug.
             * Provider-funded flow mein
             * actual pool nahi hai.
             */
            commissionValue: rule.commissionValue.toString(),
          }
        : null,
    );

    if (!rule) {
      /*
       * Actual provider income exists.
       *
       * Isko NOT_REQUIRED bol kar
       * silently lose nahi kar sakte.
       */
      if (providerFunded && Number(dto.providerCommissionAmount) > 0) {
        this.throwRpc(
          409,
          `Provider income exists but no distribution profile was found for service ${dto.serviceType}, role ${dto.role}`,
        );
      }

      return {
        commissionRequired: false,

        grossAmount: grossAmount.toFixed(2),

        commissionAmount: '0.00',

        netAmount: grossAmount.toFixed(2),

        reason: 'NO_DISTRIBUTION_PROFILE',
      };
    }

    /*
     * =====================================================
     * 4. ACTUAL COMMISSION POOL
     * =====================================================
     */

    let commissionAmount: number;

    let netAmount: number;

    if (providerFunded) {
      /*
       * ===================================================
       * VIMOPAY INCOME
       * ===================================================
       *
       * Current:
       * dummy 2%
       *
       * Future:
       * actual VimoPay MS income
       */

      const providerCommissionAmount = Number(dto.providerCommissionAmount);

      if (
        !Number.isFinite(providerCommissionAmount) ||
        providerCommissionAmount < 0
      ) {
        this.throwRpc(400, 'Provider commission amount is invalid');
      }

      commissionAmount = Number(providerCommissionAmount.toFixed(2));

      /*
       * CRITICAL:
       *
       * Provider income does NOT reduce
       * principal.
       *
       * ₹100 transaction
       * ₹2 income
       *
       * principal = ₹100
       * commission = ₹2
       */
      netAmount = grossAmount;
    } else {
      /*
       * Old model retained only
       * for non-provider-funded flows.
       */

      commissionAmount = this.calculateCommissionAmount(
        grossAmount,

        rule.commissionType,

        Number(rule.commissionValue),
      );

      if (commissionAmount >= grossAmount) {
        this.throwRpc(409, 'Commission must be less than transaction amount');
      }

      netAmount = Number((grossAmount - commissionAmount).toFixed(2));
    }

    console.log('[COMMISSION] INCOME POOL', {
      source: providerFunded ? 'PROVIDER' : 'RULE',

      grossAmount,

      commissionAmount,

      netAmount,
    });

    /*
     * Provider may return zero income.
     */

    if (commissionAmount === 0) {
      return {
        commissionRequired: false,

        grossAmount: grossAmount.toFixed(2),

        commissionAmount: '0.00',

        netAmount: grossAmount.toFixed(2),

        reason: providerFunded ? 'ZERO_PROVIDER_INCOME' : 'ZERO_COMMISSION',
      };
    }

    if (commissionAmount < 0) {
      this.throwRpc(409, 'Commission amount cannot be negative');
    }

    /*
     * =====================================================
     * 5. DISTRIBUTION PLAN
     * =====================================================
     */

    console.log('[COMMISSION] BEFORE DISTRIBUTION PLAN', {
      sourceUserId: dto.userId,

      sourceRole: dto.role,

      serviceType: dto.serviceType,

      ruleId: rule.id,

      /*
       * THIS MUST NOW BE PROVIDER INCOME.
       */
      commissionAmount,
    });

    const allocations = await this.buildDistributionPlan({
      sourceUserId: dto.userId,

      sourceRole: dto.role,

      serviceType: dto.serviceType,

      ruleId: rule.id,

      commissionAmount,
    });

    console.log('[COMMISSION] DISTRIBUTION PLAN OK', allocations);

    /*
     * =====================================================
     * 6. MONEY CONSERVATION
     * =====================================================
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
     * 7. ATOMIC CREATE
     * =====================================================
     */

    console.log('[COMMISSION] BEFORE DB CREATE', {
      allocationCount: allocations.length,

      commissionAmount,
    });

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          /*
           * Concurrent idempotency.
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
           * Main commission/income record.
           */

          const commission = await tx.commission.create({
            data: {
              referenceId: this.generateReference(),

              transactionId: dto.providerTransactionId,

              transactionReference: dto.providerTransactionReference,

              userId: dto.userId,

              role: dto.role,

              serviceType: dto.serviceType,

              operator: dto.operator,

              /*
               * Full provider transaction.
               */
              transactionAmount: grossAmount,

              /*
               * Provider-generated income.
               */
              commissionAmount,

              /*
               * Legacy DB field.
               *
               * Provider amount DOES NOT
               * come from this type/value.
               */
              commissionType: rule.commissionType,

              ruleId: rule.id,

              status: 'PENDING',

              idempotencyKey: dto.idempotencyKey,

              metadata: {
                source: providerFunded
                  ? 'VIMOPAY_PROVIDER_INCOME'
                  : 'RULE_CALCULATED_COMMISSION',

                commissionAmountSource: providerFunded ? 'PROVIDER' : 'RULE',

                providerIncomeSource: dto.providerIncomeSource ?? null,

                transactionAmount: grossAmount,

                /*
                 * Full principal.
                 */
                principalAmount: netAmount,

                commissionAmount,
              },
            },
          });

          /*
           * Freeze all distributions.
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

        commissionAmount: result.commission.commissionAmount.toString(),
      });

      return {
        ...result.commission,

        transactionAmount: result.commission.transactionAmount.toString(),

        commissionAmount: result.commission.commissionAmount.toString(),

        grossAmount: grossAmount.toFixed(2),

        /*
         * Provider funded:
         * FULL principal.
         */
        netAmount: netAmount.toFixed(2),

        amountSource: providerFunded ? 'PROVIDER' : 'RULE',

        providerIncomeSource: dto.providerIncomeSource ?? null,

        commissionRequired: true,

        duplicate: result.duplicate,

        allocations: result.distributionTransactions.map((item) => ({
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
          const duplicateGross = Number(duplicate.transactionAmount);

          const metadata =
            duplicate.metadata &&
            typeof duplicate.metadata === 'object' &&
            !Array.isArray(duplicate.metadata)
              ? (duplicate.metadata as Record<string, unknown>)
              : {};

          const duplicateProviderFunded =
            metadata.commissionAmountSource === 'PROVIDER';

          const duplicateNet = duplicateProviderFunded
            ? duplicateGross
            : Number(
                (duplicateGross - Number(duplicate.commissionAmount)).toFixed(
                  2,
                ),
              );

          return {
            ...duplicate,

            transactionAmount: duplicate.transactionAmount.toString(),

            commissionAmount: duplicate.commissionAmount.toString(),

            grossAmount: duplicateGross.toFixed(2),

            netAmount: duplicateNet.toFixed(2),

            amountSource: duplicateProviderFunded ? 'PROVIDER' : 'RULE',

            commissionRequired: true,

            duplicate: true,

            allocations: duplicate.distributionTransactions.map((item) => ({
              id: item.id,

              distributionId: item.distributionId,

              recipientUserId: item.recipientUserId,

              recipientRole: item.recipientRole,

              amount: item.amount.toString(),

              walletType: item.walletType,

              status: item.status,

              transactionId: item.transactionId,

              transactionReference: item.transactionReference,

              failureReason: item.failureReason,

              creditedAt: item.creditedAt,

              isSource: item.recipientUserId === dto.userId,
            })),
          };
        }
      }

      if (error?.code === 'P2034') {
        this.throwRpc(409, 'Commission creation conflict. Please retry.');
      }

      if (error instanceof RpcException) {
        throw error;
      }

      this.throwRpc(
        500,
        error?.message ?? 'Provider commission creation failed',
      );
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

  async markDistributionReversed(dto: {
    distributionTransactionId: string;

    reversalWalletTransactionId: string;

    reversalWalletTransactionReference: string;
  }) {
    if (!dto.distributionTransactionId?.trim()) {
      this.throwRpc(400, 'Distribution transaction ID is required');
    }

    if (!dto.reversalWalletTransactionId?.trim()) {
      this.throwRpc(400, 'Reversal wallet transaction ID is required');
    }

    if (!dto.reversalWalletTransactionReference?.trim()) {
      this.throwRpc(400, 'Reversal wallet transaction reference is required');
    }

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
     * Already reversed.
     * Idempotent replay.
     */
    if (allocation.status === 'REVERSED') {
      if (
        allocation.reversalTransactionReference &&
        allocation.reversalTransactionReference !==
          dto.reversalWalletTransactionReference
      ) {
        this.throwRpc(
          409,
          'Commission distribution was already reversed using another wallet transaction',
        );
      }

      return allocation;
    }

    /*
     * Only an actually credited
     * allocation can be reversed.
     */
    if (allocation.status !== 'SUCCESS') {
      this.throwRpc(
        409,
        `Commission distribution cannot be reversed from ${allocation.status} state`,
      );
    }

    return this.prisma.commissionDistributionTransaction.update({
      where: {
        id: allocation.id,
      },

      data: {
        status: 'REVERSED',

        reversalTransactionId: dto.reversalWalletTransactionId,

        reversalTransactionReference: dto.reversalWalletTransactionReference,

        reversedAt: new Date(),

        reversalFailureReason: null,
      },
    });
  }

  async finalizeProviderCommissionReversal(
    commissionReference: string,
    reason: string,
  ) {
    if (!commissionReference?.trim()) {
      this.throwRpc(400, 'Commission reference is required');
    }

    if (!reason?.trim()) {
      this.throwRpc(400, 'Commission reversal reason is required');
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
     * Idempotent.
     */
    if (commission.status === 'REVERSED') {
      return {
        status: 'REVERSED',

        commissionReference: commission.referenceId,

        commissionAmount: commission.commissionAmount.toString(),

        remainingAllocations: 0,
      };
    }

    /*
     * Any original successful allocation
     * still not reversed?
     */
    const remaining = commission.distributionTransactions.filter(
      (allocation) => allocation.status === 'SUCCESS',
    );

    if (remaining.length > 0) {
      return {
        status: 'PENDING',

        commissionReference: commission.referenceId,

        commissionAmount: commission.commissionAmount.toString(),

        remainingAllocations: remaining.length,
      };
    }

    /*
     * PENDING/FAILED allocations were
     * never credited.
     *
     * They don't require debit reversal.
     */
    await this.prisma.commissionDistributionTransaction.updateMany({
      where: {
        commissionId: commission.id,

        status: {
          in: ['PENDING', 'FAILED'],
        },
      },

      data: {
        failureReason: 'Cancelled because provider transaction was reversed',
      },
    });

    const updated = await this.prisma.commission.update({
      where: {
        id: commission.id,
      },

      data: {
        status: 'REVERSED',

        reversedAt: new Date(),

        reversalReason: reason.trim().slice(0, 500),
      },
    });

    return {
      status: 'REVERSED',

      commissionReference: updated.referenceId,

      commissionAmount: updated.commissionAmount.toString(),

      remainingAllocations: 0,
    };
  }
}
