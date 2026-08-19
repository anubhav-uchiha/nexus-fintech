import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  CreateRoleRegisterPermissionPayloadDto,
  ROLE_REGISTER_PERMISSION_PATTERNS,
  RoleRegisterPermissionIdsDto,
  RoleRegisterPermissionRegistrarIdDto,
  UpdateRoleRegisterPermissionStatusPayloadDto,
} from '@nexus/common/role-register-permission';

import { RoleRegisterPermissionService } from './role-register-permission.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class RoleRegisterPermissionKafkaController {
  constructor(private readonly service: RoleRegisterPermissionService) {}

  @MessagePattern(ROLE_REGISTER_PERMISSION_PATTERNS.CREATE)
  create(@Payload() dto: CreateRoleRegisterPermissionPayloadDto) {
    return this.service.create(dto.registrarRoleId, {
      targetRoleId: dto.targetRoleId,
      isActive: dto.isActive,
    });
  }

  @MessagePattern(ROLE_REGISTER_PERMISSION_PATTERNS.FIND_BY_REGISTRAR)
  findByRegistrar(@Payload() dto: RoleRegisterPermissionRegistrarIdDto) {
    return this.service.findByRegistrar(dto.registrarRoleId);
  }

  @MessagePattern(ROLE_REGISTER_PERMISSION_PATTERNS.UPDATE_STATUS)
  updateStatus(@Payload() dto: UpdateRoleRegisterPermissionStatusPayloadDto) {
    return this.service.updateStatus(dto.registrarRoleId, dto.targetRoleId, {
      isActive: dto.isActive,
    });
  }

  @MessagePattern(ROLE_REGISTER_PERMISSION_PATTERNS.REMOVE)
  remove(@Payload() dto: RoleRegisterPermissionIdsDto) {
    return this.service.remove(dto.registrarRoleId, dto.targetRoleId);
  }
}
