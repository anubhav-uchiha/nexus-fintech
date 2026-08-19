import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { RoleModule } from '../role/role.module';

import { RoleRegisterPermissionRepository } from './repository/role-register-permission.repository';
import { RoleRegisterPermissionService } from './role-register-permission.service';
import { RoleRegisterPermissionKafkaController } from './role-register-permission.kafka.controller';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Module({
  imports: [PrismaModule, RoleModule],
  controllers: [RoleRegisterPermissionKafkaController],
  providers: [
    RoleRegisterPermissionRepository,
    RoleRegisterPermissionService,
    HttpToRpcExceptionInterceptor,
  ],
  exports: [RoleRegisterPermissionService],
})
export class RoleRegisterPermissionModule {}
