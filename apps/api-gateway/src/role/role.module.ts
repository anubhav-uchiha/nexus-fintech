import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';
import { RoleController } from './role.controller';

@Module({
  imports: [AuthModule],
  controllers: [RoleController],
  providers: [RpcToHttpExceptionInterceptor],
})
export class RoleModule {}
