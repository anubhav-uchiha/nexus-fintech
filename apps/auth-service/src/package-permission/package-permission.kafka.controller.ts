import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  PACKAGE_PERMISSION_PATTERNS,
  PackagePermissionIdsDto,
  PackagePermissionPackageIdDto,
} from '@nexus/common/package-permission';

import { PackagePermissionService } from './package-permission.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class PackagePermissionKafkaController {
  constructor(
    private readonly packagePermissionService: PackagePermissionService,
  ) {}

  @MessagePattern(PACKAGE_PERMISSION_PATTERNS.ASSIGN)
  assign(@Payload() dto: PackagePermissionIdsDto) {
    return this.packagePermissionService.assign(dto.packageId, {
      permissionId: dto.permissionId,
    });
  }

  @MessagePattern(PACKAGE_PERMISSION_PATTERNS.FIND_BY_PACKAGE)
  findByPackage(@Payload() dto: PackagePermissionPackageIdDto) {
    return this.packagePermissionService.findByPackage(dto.packageId);
  }

  @MessagePattern(PACKAGE_PERMISSION_PATTERNS.REMOVE)
  remove(@Payload() dto: PackagePermissionIdsDto) {
    return this.packagePermissionService.remove(
      dto.packageId,
      dto.permissionId,
    );
  }
}
