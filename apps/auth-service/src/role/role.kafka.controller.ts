import { Controller, UseInterceptors } from '@nestjs/common';
import { RoleService } from './role.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateRoleDto,
  ROLE_PATTERNS,
  RoleIdDto,
  UpdateRoleDto,
  UpdateRolePayloadDto,
  UpdateRoleStatusPayloadDto,
} from '@nexus/common/role';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class RoleKafkaController {
  constructor(private readonly roleService: RoleService) {}

  @MessagePattern(ROLE_PATTERNS.CREATE)
  async create(@Payload() dto: CreateRoleDto) {
    return await this.roleService.create(dto);
  }

  @MessagePattern(ROLE_PATTERNS.FIND_ALL)
  async findAll() {
    return await this.roleService.findAll();
  }

  @MessagePattern(ROLE_PATTERNS.FIND_BY_ID)
  async findById(@Payload() dto: RoleIdDto) {
    return await this.roleService.findById(dto.id);
  }

  @MessagePattern(ROLE_PATTERNS.UPDATE)
  async update(@Payload() dto: UpdateRolePayloadDto) {
    const { id, ...UpdateRoleDto } = dto;

    return await this.roleService.update(id, UpdateRoleDto);
  }

  @MessagePattern(ROLE_PATTERNS.UPDATE_STATUS)
  updateStatus(@Payload() dto: UpdateRoleStatusPayloadDto) {
    const { id, isActive } = dto;

    return this.roleService.updateStatus(id, {
      isActive,
    });
  }
}
