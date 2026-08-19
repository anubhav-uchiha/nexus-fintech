import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AuthorizationService } from './authorization.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';
import {
  AUTH_PATTERNS,
  ResolveIdentityPermissionsDto,
  ResolveRolePermissionsDto,
} from '@nexus/common';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class AuthorizationKafkaController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @MessagePattern(AUTH_PATTERNS.RESOLVE_ROLE_PERMISSIONS)
  resolveRolePermissions(@Payload() dto: ResolveRolePermissionsDto) {
    return this.authorizationService.resolveRolePermissions(dto.roleId);
  }

  @MessagePattern(AUTH_PATTERNS.RESOLVE_IDENTITY_PERMISSIONS)
  resolveIdentityPermissions(@Payload() dto: ResolveIdentityPermissionsDto) {
    return this.authorizationService.resolveIdentityPermissions(dto.identityId);
  }
}
