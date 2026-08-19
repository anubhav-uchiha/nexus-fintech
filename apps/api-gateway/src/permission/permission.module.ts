import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

import { PermissionController } from './permission.controller';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@Module({
  imports: [AuthModule],
  controllers: [PermissionController],
  providers: [RpcToHttpExceptionInterceptor],
})
export class PermissionModule {}
