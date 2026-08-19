import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';

import { CreateCommissionRuleDto } from '@nexus/common/commission/dto/create-commission-rule.dto';

import { UpdateCommissionRuleDto } from '@nexus/common/commission/dto/update-commission-rule.dto';

@Injectable()
export class CommissionRuleService implements OnModuleInit {
  constructor(
    @Inject('COMMISSION_RULE_SERVICE')
    private readonly commissionClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.CREATE_RULE,
    );

    this.commissionClient.subscribeToResponseOf(COMMISSION_PATTERNS.GET_RULES);

    this.commissionClient.subscribeToResponseOf(COMMISSION_PATTERNS.GET_RULE);

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.UPDATE_RULE,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.DELETE_RULE,
    );

    await this.commissionClient.connect();
  }

  async createRule(dto: CreateCommissionRuleDto) {
    return this.send(COMMISSION_PATTERNS.CREATE_RULE, dto);
  }

  async getRules() {
    return this.send(COMMISSION_PATTERNS.GET_RULES, {});
  }

  async getRule(id: string) {
    return this.send(COMMISSION_PATTERNS.GET_RULE, { id });
  }

  async updateRule(id: string, dto: UpdateCommissionRuleDto) {
    return this.send(COMMISSION_PATTERNS.UPDATE_RULE, {
      id,
      dto,
    });
  }

  async deleteRule(id: string) {
    return this.send(COMMISSION_PATTERNS.DELETE_RULE, { id });
  }

  private async send(pattern: string, payload: any) {
    try {
      return await firstValueFrom(this.commissionClient.send(pattern, payload));
    } catch (error: any) {
      let rpcError = error;

      if (error?.error !== undefined) {
        rpcError = error.error;
      }

      if (typeof rpcError === 'string') {
        try {
          rpcError = JSON.parse(rpcError);
        } catch {
          // keep original string
        }
      }

      const status =
        Number(rpcError?.status) || Number(rpcError?.statusCode) || 500;

      const message =
        rpcError?.message ||
        error?.message ||
        'Commission rule operation failed';

      throw new RpcException({
        status,
        message,
      });
    }
  }
}
