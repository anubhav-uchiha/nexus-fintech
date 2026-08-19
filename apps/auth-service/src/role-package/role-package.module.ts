import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { PackageModule } from '../package/package.module';
import { RoleModule } from '../role/role.module';

import { RolePackageRepository } from './repository/role-package.repository';
import { RolePackageService } from './role-package.service';
import { RolePackageKafkaController } from './role-package.kafka.controller';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Module({
  imports: [PrismaModule, RoleModule, PackageModule],
  controllers: [RolePackageKafkaController],
  providers: [
    RolePackageRepository,
    RolePackageService,
    HttpToRpcExceptionInterceptor,
  ],
  exports: [RolePackageService],
})
export class RolePackageModule {}
