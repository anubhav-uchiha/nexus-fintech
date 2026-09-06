import { Controller } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';
import { CalculateCommissionDto } from '@nexus/common/commission/dto/calculate-commission.dto';
import { CreateCommissionRuleDto } from '@nexus/common/commission/dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from '@nexus/common/commission/dto/update-commission-rule.dto';
import { CommissionRuleService } from './commission-rule.service';
import { CommissionDistributionService } from './commission-distribution.service';
import { CreateCommissionDistributionDto } from '@nexus/common/commission/dto/create-commission-distribution.dto';
import { UpdateCommissionDistributionDto } from '@nexus/common/commission/dto/update-commission-distribution.dto';
import { CreateCommissionHierarchyDto } from '@nexus/common/commission/dto/create-commission-hierarchy.dto';
import { CommissionHierarchyService } from './commission-hierarchy.service';
import { UpdateCommissionHierarchyDto } from '@nexus/common/commission/dto/update-commission-hierarchy.dto';
import { CreateProviderCommissionDto } from '@nexus/common/commission/dto/create-provider-commission.dto';

import { FinalizeProviderCommissionDto } from '@nexus/common/commission/dto/finalize-provider-commission.dto';
import { QuoteProviderCommissionDto } from '@nexus/common/commission/dto/quote-provider-commission.dto';
import {
  FinalizeProviderDistributionsDto,
  GetProviderCommissionExecutionDto,
  MarkCommissionDistributionFailedDto,
  MarkCommissionDistributionSuccessDto,
} from '@nexus/common/commission/dto/commission-distribution-execution.dto';
import { CancelProviderCommissionDto } from '@nexus/common/commission/dto/cancel-provider-commission.dto';

@Controller()
export class CommissionKafkaController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly commissionRuleService: CommissionRuleService,
    private readonly commissionDistributionService: CommissionDistributionService,
    private readonly commissionHierarchyService: CommissionHierarchyService,
  ) {}

  @MessagePattern(COMMISSION_PATTERNS.CALCULATE)
  async calculateCommission(@Payload() dto: CalculateCommissionDto) {
    return this.commissionService.calculateCommission(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.CREATE_RULE)
  async createRule(@Payload() dto: CreateCommissionRuleDto) {
    return this.commissionRuleService.createRule(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_RULE)
  async getRule(@Payload() payload: { id: string }) {
    return this.commissionRuleService.getRule(payload.id);
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_RULES)
  async getRules(
    // @Payload()
    // payload?: {
    //   serviceType?: string;
    //   role?: string;
    //   operator?: string;
    //   isActive?: boolean;
    // },
  ) {
    return this.commissionRuleService.getRules();
  }
  @MessagePattern(COMMISSION_PATTERNS.UPDATE_RULE)
  async updateRules(
    @Payload() payload: { id: string; dto: UpdateCommissionRuleDto },
  ) {
    return this.commissionRuleService.updateRule(payload.id, payload.dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.DELETE_RULE)
  async deleteRUle(@Payload() payload: { id: string }) {
    return this.commissionRuleService.deleteRule(payload.id);
  }

  @MessagePattern(COMMISSION_PATTERNS.CREATE_DISTRIBUTION)
  async createDistribution(@Payload() dto: CreateCommissionDistributionDto) {
    return this.commissionDistributionService.createDistribution(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_DISTRIBUTIONS)
  async getDistributions(
    @Payload()
    payload?: {
      commissionRuleId?: string;
    },
  ) {
    return this.commissionDistributionService.getDistributions(
      payload?.commissionRuleId,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_DISTRIBUTION)
  async getDistribution(@Payload() payload: { id: string }) {
    return this.commissionDistributionService.getDistribution(payload.id);
  }

  @MessagePattern(COMMISSION_PATTERNS.UPDATE_DISTRIBUTION)
  async updateDistribution(
    @Payload()
    payload: {
      id: string;
      dto: UpdateCommissionDistributionDto;
    },
  ) {
    return this.commissionDistributionService.updateDistribution(
      payload.id,
      payload.dto,
    );
  }
  @MessagePattern(COMMISSION_PATTERNS.DELETE_DISTRIBUTION)
  async deleteDistribution(@Payload() payload: { id: string }) {
    return this.commissionDistributionService.deleteDistribution(payload.id);
  }

  @MessagePattern(COMMISSION_PATTERNS.CREATE_HIERARCHY)
  async createHierarchy(@Payload() dto: CreateCommissionHierarchyDto) {
    return this.commissionHierarchyService.createHierarchy(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_ALL_HIERARCHY)
  async getHierarchies(@Payload() payload: { serviceType?: string }) {
    return this.commissionHierarchyService.getHierarchies(payload?.serviceType);
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_ONE_HIERARCHY)
  async getHierarchy(@Payload() payload: { id: string }) {
    return this.commissionHierarchyService.getHierarchy(payload.id);
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_PARENT_HIERARCHY)
  async getParent(
    @Payload() payload: { childUserId: string; serviceType?: string },
  ) {
    return this.commissionHierarchyService.getParent(
      payload.childUserId,
      payload.serviceType,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.RESOLVE_HIERARCHY)
  async resolveHierarchy(
    @Payload()
    payload: {
      sourceUserId: string;
      serviceType: string;
    },
  ) {
    return this.commissionHierarchyService.resolveHierarchyForUser(
      payload.sourceUserId,
      payload.serviceType,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_CHILDREN_HIERARCHY)
  async getChildren(
    @Payload() payload: { parentUserId: string; serviceType?: string },
  ) {
    return this.commissionHierarchyService.getChildren(
      payload.parentUserId,
      payload.serviceType,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.UPDATE_HIERARCHY)
  async updateHierarchy(
    @Payload() payload: { id: string; dto: UpdateCommissionHierarchyDto },
  ) {
    return this.commissionHierarchyService.updateHierarchy(
      payload.id,
      payload.dto,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.DELETE_HIERARCHY)
  async deleteHierarchy(@Payload() payload: { id: string }) {
    return this.commissionHierarchyService.deleteHierarchy(payload.id);
  }

  @MessagePattern(COMMISSION_PATTERNS.CREATE_PROVIDER_COMMISSION)
  createProviderCommission(
    @Payload()
    dto: CreateProviderCommissionDto,
  ) {
    return this.commissionService.createProviderCommission(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.FINALIZE_PROVIDER_COMMISSION)
  finalizeProviderCommission(
    @Payload()
    dto: FinalizeProviderCommissionDto,
  ) {
    return this.commissionService.finalizeProviderCommission(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.QUOTE_PROVIDER_COMMISSION)
  quoteProviderCommission(
    @Payload()
    dto: QuoteProviderCommissionDto,
  ) {
    return this.commissionService.quoteProviderCommission(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.GET_PROVIDER_COMMISSION_EXECUTION)
  getProviderCommissionExecution(
    @Payload()
    dto: GetProviderCommissionExecutionDto,
  ) {
    return this.commissionService.getProviderCommissionExecution(
      dto.commissionReference,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.MARK_DISTRIBUTION_SUCCESS)
  markDistributionSuccess(
    @Payload()
    dto: MarkCommissionDistributionSuccessDto,
  ) {
    return this.commissionService.markDistributionSuccess(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.MARK_DISTRIBUTION_FAILED)
  markDistributionFailed(
    @Payload()
    dto: MarkCommissionDistributionFailedDto,
  ) {
    return this.commissionService.markDistributionFailed(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.FINALIZE_PROVIDER_DISTRIBUTIONS)
  finalizeProviderDistributions(
    @Payload()
    dto: FinalizeProviderDistributionsDto,
  ) {
    return this.commissionService.finalizeProviderDistributions(
      dto.commissionReference,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.CANCEL_PROVIDER_COMMISSION)
  cancelProviderCommission(
    @Payload()
    dto: CancelProviderCommissionDto,
  ) {
    return this.commissionService.cancelProviderCommission(
      dto.commissionReference,
      dto.reason,
    );
  }

  @MessagePattern(COMMISSION_PATTERNS.MARK_DISTRIBUTION_REVERSED)
  markDistributionReversed(
    @Payload()
    dto: {
      distributionTransactionId: string;

      reversalWalletTransactionId: string;

      reversalWalletTransactionReference: string;
    },
  ) {
    return this.commissionService.markDistributionReversed(dto);
  }

  @MessagePattern(COMMISSION_PATTERNS.FINALIZE_PROVIDER_COMMISSION_REVERSAL)
  finalizeProviderCommissionReversal(
    @Payload()
    dto: {
      commissionReference: string;

      reason: string;
    },
  ) {
    return this.commissionService.finalizeProviderCommissionReversal(
      dto.commissionReference,

      dto.reason,
    );
  }
}
