import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CommissionRuleService } from './commission-rule.service';

import { CreateCommissionRuleDto } from '@nexus/common/commission/dto/create-commission-rule.dto';

import { UpdateCommissionRuleDto } from '@nexus/common/commission/dto/update-commission-rule.dto';

@Controller('commission-rules')
export class CommissionRuleController {
  constructor(private readonly commissionRuleService: CommissionRuleService) {}

  @Post()
  async createRule(@Body() dto: CreateCommissionRuleDto) {
    return this.commissionRuleService.createRule(dto);
  }

  @Get()
  async getRules() {
    return this.commissionRuleService.getRules();
  }

  @Get(':id')
  async getRule(@Param('id') id: string) {
    return this.commissionRuleService.getRule(id);
  }

  @Patch(':id')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
  ) {
    return this.commissionRuleService.updateRule(id, dto);
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string) {
    return this.commissionRuleService.deleteRule(id);
  }
}
