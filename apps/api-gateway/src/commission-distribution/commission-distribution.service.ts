import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';
import { CreateCommissionDistributionDto } from '@nexus/common/commission/dto/create-commission-distribution.dto';
import { UpdateCommissionDistributionDto } from '@nexus/common/commission/dto/update-commission-distribution.dto';

@Injectable()
export class CommissionDistributionService implements OnModuleInit {
  constructor(
    @Inject('COMMISSION_DISTRIBUTION_SERVICE')
    private readonly commissionClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.CREATE_DISTRIBUTION,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_DISTRIBUTIONS,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_DISTRIBUTION,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.UPDATE_DISTRIBUTION,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.DELETE_DISTRIBUTION,
    );

    await this.commissionClient.connect();
  }

  async createDistribution(dto: CreateCommissionDistributionDto) {
    return this.commissionClient.send(
      COMMISSION_PATTERNS.CREATE_DISTRIBUTION,
      dto,
    );
  }

  async getDistributions(commissionRuleId?: string) {
    return this.commissionClient.send(
      COMMISSION_PATTERNS.GET_DISTRIBUTIONS,
      commissionRuleId ? { commissionRuleId } : {},
    );
  }

  async getDistribution(id: string) {
    return this.commissionClient.send(COMMISSION_PATTERNS.GET_DISTRIBUTION, {
      id,
    });
  }

  async updateDistribution(id: string, dto: UpdateCommissionDistributionDto) {
    return this.commissionClient.send(COMMISSION_PATTERNS.UPDATE_DISTRIBUTION, {
      id,
      dto,
    });
  }

  async deleteDistribution(id: string) {
    return this.commissionClient.send(COMMISSION_PATTERNS.DELETE_DISTRIBUTION, {
      id,
    });
  }
}
