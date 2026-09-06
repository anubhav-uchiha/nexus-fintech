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
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Commission Distributions')
@Controller('commission-distributions')
export class CommissionDistributionController {
  constructor(
    private readonly commissionDistributionService: CommissionDistributionService,
  ) {}

  @Post('distributions')
  @ApiOperation({
    summary: 'Create commission distribution',
    description:
      'Creates a commission distribution configuration for a commission rule.',
  })
  @ApiCreatedResponse({
    description: 'Commission distribution created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid commission distribution payload',
  })
  async createDistribution(@Body() dto: CreateCommissionDistributionDto) {
    return this.commissionDistributionService.createDistribution(dto);
  }

  @Get('distributions')
  @ApiOperation({
    summary: 'Get commission distributions',
    description:
      'Returns commission distributions. Optionally filters them by commission rule ID.',
  })
  @ApiQuery({
    name: 'commissionRuleId',
    required: false,
    type: String,
    description: 'Optional commission rule ID used to filter distributions',
  })
  @ApiOkResponse({
    description: 'Commission distributions retrieved successfully',
  })
  async getDistributions(@Query('commissionRuleId') commissionRuleId?: string) {
    return this.commissionDistributionService.getDistributions(
      commissionRuleId,
    );
  }

  @Get('distributions/:id')
  @ApiOperation({
    summary: 'Get commission distribution by ID',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission distribution ID',
  })
  @ApiOkResponse({
    description: 'Commission distribution retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Commission distribution not found',
  })
  async getDistribution(@Param('id') id: string) {
    return this.commissionDistributionService.getDistribution(id);
  }

  @Patch('distributions/:id')
  @ApiOperation({
    summary: 'Update commission distribution',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission distribution ID',
  })
  @ApiOkResponse({
    description: 'Commission distribution updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid commission distribution update payload',
  })
  @ApiNotFoundResponse({
    description: 'Commission distribution not found',
  })
  async updateDistribution(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionDistributionDto,
  ) {
    return this.commissionDistributionService.updateDistribution(id, dto);
  }

  @Delete('distributions/:id')
  @ApiOperation({
    summary: 'Delete commission distribution',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission distribution ID',
  })
  @ApiOkResponse({
    description: 'Commission distribution deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Commission distribution not found',
  })
  async deleteDistribution(@Param('id') id: string) {
    return this.commissionDistributionService.deleteDistribution(id);
  }
}
