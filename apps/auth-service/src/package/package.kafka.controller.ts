import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  CreatePackageDto,
  PackageIdDto,
  PACKAGE_PATTERNS,
  UpdatePackagePayloadDto,
  UpdatePackageStatusPayloadDto,
} from '@nexus/common/package';

import { PackageService } from './package.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class PackageKafkaController {
  constructor(private readonly packageService: PackageService) {}

  @MessagePattern(PACKAGE_PATTERNS.CREATE)
  async create(@Payload() dto: CreatePackageDto) {
    return await this.packageService.create(dto);
  }

  @MessagePattern(PACKAGE_PATTERNS.FIND_ALL)
  async findAll() {
    return await this.packageService.findAll();
  }

  @MessagePattern(PACKAGE_PATTERNS.FIND_BY_ID)
  async findById(@Payload() dto: PackageIdDto) {
    return await this.packageService.findById(dto.id);
  }

  @MessagePattern(PACKAGE_PATTERNS.UPDATE)
  async update(@Payload() dto: UpdatePackagePayloadDto) {
    const { id, ...updateDto } = dto;

    return await this.packageService.update(id, updateDto);
  }

  @MessagePattern(PACKAGE_PATTERNS.UPDATE_STATUS)
  async updateStatus(@Payload() dto: UpdatePackageStatusPayloadDto) {
    const { id, isActive } = dto;

    return await this.packageService.updateStatus(id, { isActive });
  }
}
