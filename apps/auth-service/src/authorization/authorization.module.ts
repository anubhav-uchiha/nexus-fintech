import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { AuthorizationRepository } from './repository/authorization.repository';
import { AuthorizationService } from './authorization.service';
import { AuthorizationKafkaController } from './authorization.kafka.controller';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Module({
  imports: [PrismaModule],
  controllers: [AuthorizationKafkaController],
  providers: [
    AuthorizationRepository,
    AuthorizationService,
    HttpToRpcExceptionInterceptor,
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
