import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommissionDistributionService } from './commission-distribution.service';
import { CreateCommissionDistributionDto } from '@nexus/common/commission/dto/create-commission-distribution.dto';
import { UpdateCommissionDistributionDto } from '@nexus/common/commission/dto/update-commission-distribution.dto';

@Controller('commission-distributions')
export class CommissionDistributionController {
  constructor(
    private readonly commissionDistributionService: CommissionDistributionService,
  ) {}

  @Post('distributions')
  async createDistribution(@Body() dto: CreateCommissionDistributionDto) {
    return this.commissionDistributionService.createDistribution(dto);
  }

  @Get('distributions')
  async getDistributions(@Query('commissionRuleId') commissionRuleId?: string) {
    return this.commissionDistributionService.getDistributions(
      commissionRuleId,
    );
  }

  @Get('distributions/:id')
  async getDistribution(@Param('id') id: string) {
    return this.commissionDistributionService.getDistribution(id);
  }

  @Patch('distributions/:id')
  async updateDistribution(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionDistributionDto,
  ) {
    return this.commissionDistributionService.updateDistribution(id, dto);
  }

  @Delete('distributions/:id')
  async deleteDistribution(@Param('id') id: string) {
    return this.commissionDistributionService.deleteDistribution(id);
  }
}
