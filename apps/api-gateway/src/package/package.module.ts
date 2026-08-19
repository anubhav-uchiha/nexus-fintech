import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PackageController } from './package.controller';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@Module({
  imports: [AuthModule],
  controllers: [PackageController],
  providers: [RpcToHttpExceptionInterceptor],
})
export class PackageModule {}
