import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreatePermissionDto,
  PermissionIdDto,
  PERMISSION_PATTERNS,
  UpdatePermissionPayloadDto,
  UpdatePermissionStatusPayloadDto,
} from '@nexus/common/permission';

import { PermissionService } from './permission.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class PermissionKafkaController {
  constructor(private readonly permissionService: PermissionService) {}

  @MessagePattern(PERMISSION_PATTERNS.CREATE)
  async create(@Payload() dto: CreatePermissionDto) {
    return await this.permissionService.create(dto);
  }

  @MessagePattern(PERMISSION_PATTERNS.FIND_ALL)
  async findAll() {
    return await this.permissionService.findAll();
  }

  @MessagePattern(PERMISSION_PATTERNS.FIND_BY_ID)
  async findById(@Payload() dto: PermissionIdDto) {
    return await this.permissionService.findById(dto.id);
  }

  @MessagePattern(PERMISSION_PATTERNS.UPDATE)
  async update(@Payload() dto: UpdatePermissionPayloadDto) {
    const { id, ...updateDto } = dto;

    return await this.permissionService.update(id, updateDto);
  }

  @MessagePattern(PERMISSION_PATTERNS.UPDATE_STATUS)
  async updateStatus(@Payload() dto: UpdatePermissionStatusPayloadDto) {
    const { id, isActive } = dto;

    return await this.permissionService.updateStatus(id, {
      isActive,
    });
  }
}
