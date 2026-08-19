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

@Controller('commission-hierarchy')
export class CommissionHierarchyController {
  constructor(
    private readonly commissionHierarchyService: CommissionHierarchyService,
  ) {}

  @Post()
  async createHierarchy(@Body() dto: CreateCommissionHierarchyDto) {
    return await this.commissionHierarchyService.create(dto);
  }

  @Get()
  getAll(@Query('serviceType') serviceType?: string) {
    return this.commissionHierarchyService.getAll(serviceType);
  }

  @Get('parent/:parentUserId/children')
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
  getParents(
    @Param('childUserId')
    childUserId: string,

    @Query('serviceType')
    serviceType?: string,
  ) {
    return this.commissionHierarchyService.getParents(childUserId, serviceType);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.commissionHierarchyService.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateCommissionHierarchyDto,
  ) {
    return this.commissionHierarchyService.update(id, dto);
  }

  @Delete(':id')
  delete(
    @Param('id')
    id: string,
  ) {
    return this.commissionHierarchyService.delete(id);
  }
}
