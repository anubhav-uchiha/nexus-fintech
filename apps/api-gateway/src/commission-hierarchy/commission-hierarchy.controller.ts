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
import { CommissionHierarchyService } from './commission-hierarchy.service';
import { CreateCommissionHierarchyDto } from '@nexus/common/commission/dto/create-commission-hierarchy.dto';
import { UpdateCommissionHierarchyDto } from '@nexus/common/commission/dto/update-commission-hierarchy.dto';
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

@ApiTags('Commission Hierarchy')
@Controller('commission-hierarchy')
export class CommissionHierarchyController {
  constructor(
    private readonly commissionHierarchyService: CommissionHierarchyService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create commission hierarchy',
    description:
      'Creates a parent-child commission hierarchy relationship between users.',
  })
  @ApiCreatedResponse({
    description: 'Commission hierarchy created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid commission hierarchy payload',
  })
  async createHierarchy(@Body() dto: CreateCommissionHierarchyDto) {
    return await this.commissionHierarchyService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get commission hierarchy records',
    description:
      'Returns all commission hierarchy records, optionally filtered by service type.',
  })
  @ApiQuery({
    name: 'serviceType',
    required: false,
    type: String,
    description:
      'Optional service type used to filter commission hierarchy records',
  })
  @ApiOkResponse({
    description: 'Commission hierarchy records retrieved successfully',
  })
  getAll(@Query('serviceType') serviceType?: string) {
    return this.commissionHierarchyService.getAll(serviceType);
  }

  @Get('parent/:parentUserId/children')
  @ApiOperation({
    summary: 'Get children of a parent user',
    description:
      'Returns child users configured under a specific parent in the commission hierarchy.',
  })
  @ApiParam({
    name: 'parentUserId',
    required: true,
    description: 'Parent user ID',
  })
  @ApiQuery({
    name: 'serviceType',
    required: false,
    type: String,
    description: 'Optional service type used to filter hierarchy relationships',
  })
  @ApiOkResponse({
    description: 'Child hierarchy records retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Parent user or hierarchy relationship not found',
  })
  getChildren(
    @Param('parentUserId') parentUserId: string,
    @Query('serviceType') serviceType?: string,
  ) {
    return this.commissionHierarchyService.getChildren(
      parentUserId,
      serviceType,
    );
  }

  @Get('resolve/:sourceUserId')
  @ApiOperation({
    summary: 'Resolve commission hierarchy for a user',
    description:
      'Resolves the applicable commission hierarchy chain for a source user and service type.',
  })
  @ApiParam({
    name: 'sourceUserId',
    required: true,
    description: 'Source user ID',
  })
  @ApiQuery({
    name: 'serviceType',
    required: true,
    type: String,
    description:
      'Service type for which the commission hierarchy should be resolved',
  })
  @ApiOkResponse({
    description: 'Commission hierarchy resolved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Service type is missing or invalid',
  })
  @ApiNotFoundResponse({
    description: 'Source user or applicable commission hierarchy not found',
  })
  resolveHierarchy(
    @Param('sourceUserId') sourceUserId: string,
    @Query('serviceType') serviceType: string,
  ) {
    return this.commissionHierarchyService.resolveHierarchy(
      sourceUserId,
      serviceType,
    );
  }

  @Get('child/:childUserId/parents')
  @ApiOperation({
    summary: 'Get parents of a child user',
    description:
      'Returns parent hierarchy relationships for a specific child user.',
  })
  @ApiParam({
    name: 'childUserId',
    required: true,
    description: 'Child user ID',
  })
  @ApiQuery({
    name: 'serviceType',
    required: false,
    type: String,
    description:
      'Optional service type used to filter parent hierarchy relationships',
  })
  @ApiOkResponse({
    description: 'Parent hierarchy records retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Child user or hierarchy relationship not found',
  })
  getParents(
    @Param('childUserId')
    childUserId: string,

    @Query('serviceType')
    serviceType?: string,
  ) {
    return this.commissionHierarchyService.getParents(childUserId, serviceType);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get commission hierarchy by ID',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission hierarchy record ID',
  })
  @ApiOkResponse({
    description: 'Commission hierarchy record retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Commission hierarchy record not found',
  })
  getById(@Param('id') id: string) {
    return this.commissionHierarchyService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update commission hierarchy',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission hierarchy record ID',
  })
  @ApiOkResponse({
    description: 'Commission hierarchy updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid commission hierarchy update payload',
  })
  @ApiNotFoundResponse({
    description: 'Commission hierarchy record not found',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateCommissionHierarchyDto,
  ) {
    return this.commissionHierarchyService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete commission hierarchy',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Commission hierarchy record ID',
  })
  @ApiOkResponse({
    description: 'Commission hierarchy deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Commission hierarchy record not found',
  })
  delete(
    @Param('id')
    id: string,
  ) {
    return this.commissionHierarchyService.delete(id);
  }
}
