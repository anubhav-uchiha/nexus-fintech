import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PermissionRepository } from './repository/permission.repository';
import { PermissionService } from './permission.service';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';
import { PermissionKafkaController } from './permission.kafka.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PermissionKafkaController],
  providers: [
    PermissionService,
    PermissionRepository,
    HttpToRpcExceptionInterceptor,
  ],
  exports: [PermissionService],
})
export class PermissionModule {}
