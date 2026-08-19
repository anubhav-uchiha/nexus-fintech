import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  ROLE_PACKAGE_PATTERNS,
  RolePackageIdsDto,
  RolePackageRoleIdDto,
} from '@nexus/common/role-package';

import { RolePackageService } from './role-package.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class RolePackageKafkaController {
  constructor(private readonly rolePackageService: RolePackageService) {}

  @MessagePattern(ROLE_PACKAGE_PATTERNS.ASSIGN)
  assign(@Payload() dto: RolePackageIdsDto) {
    return this.rolePackageService.assign(dto.roleId, {
      packageId: dto.packageId,
    });
  }

  @MessagePattern(ROLE_PACKAGE_PATTERNS.FIND_BY_ROLE)
  findByRole(@Payload() dto: RolePackageRoleIdDto) {
    return this.rolePackageService.findByRole(dto.roleId);
  }

  @MessagePattern(ROLE_PACKAGE_PATTERNS.REMOVE)
  remove(@Payload() dto: RolePackageIdsDto) {
    return this.rolePackageService.remove(dto.roleId, dto.packageId);
  }
}
