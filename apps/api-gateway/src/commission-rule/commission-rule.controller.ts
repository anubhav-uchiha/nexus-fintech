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
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Commission Rules')
@Controller('commission-rules')
export class CommissionRuleController {
  constructor(private readonly commissionRuleService: CommissionRuleService) {}

  @Post()
  @ApiOperation({
    summary: 'Create commission rule',
    description:
      'Creates a new commission rule used for commission calculation.',
  })
  @ApiCreatedResponse({
    description: 'Commission rule created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid commission rule payload',
  })
  async createRule(@Body() dto: CreateCommissionRuleDto) {
    return this.commissionRuleService.createRule(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all commission rules',
    description: 'Returns all configured commission rules.',
  })
  @ApiOkResponse({
    description: 'Commission rules retrieved successfully',
  })
  async getRules() {
    return this.commissionRuleService.getRules();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get commission rule by ID',
    description: 'Returns a specific commission rule using its ID.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission rule ID',
  })
  @ApiOkResponse({
    description: 'Commission rule retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Commission rule not found',
  })
  async getRule(@Param('id') id: string) {
    return this.commissionRuleService.getRule(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update commission rule',
    description: 'Updates an existing commission rule using its ID.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission rule ID',
  })
  @ApiOkResponse({
    description: 'Commission rule updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid commission rule update payload',
  })
  @ApiNotFoundResponse({
    description: 'Commission rule not found',
  })
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
  ) {
    return this.commissionRuleService.updateRule(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete commission rule',
    description: 'Deletes a commission rule using its ID.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission rule ID',
  })
  @ApiOkResponse({
    description: 'Commission rule deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Commission rule not found',
  })
  async deleteRule(@Param('id') id: string) {
    return this.commissionRuleService.deleteRule(id);
  }
}
