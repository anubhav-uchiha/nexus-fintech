import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { PrismaModule } from '../database/prisma.module';
import { RoleRepository } from './repository/role.repository';
import { RoleKafkaController } from './role.kafka.controller';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Module({
  imports: [PrismaModule],
  controllers: [RoleKafkaController],
  providers: [RoleService, RoleRepository, HttpToRpcExceptionInterceptor],
  exports: [RoleService],
})
export class RoleModule {}
