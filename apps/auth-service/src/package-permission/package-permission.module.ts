import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { PackageModule } from '../package/package.module';
import { PermissionModule } from '../permission/permission.module';

import { PackagePermissionRepository } from './repository/package-permission.repository';
import { PackagePermissionService } from './package-permission.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';
import { PackagePermissionKafkaController } from './package-permission.kafka.controller';

@Module({
  imports: [PrismaModule, PackageModule, PermissionModule],
  controllers: [PackagePermissionKafkaController],
  providers: [
    PackagePermissionRepository,
    PackagePermissionService,
    HttpToRpcExceptionInterceptor,
  ],
  exports: [PackagePermissionService],
})
export class PackagePermissionModule {}
