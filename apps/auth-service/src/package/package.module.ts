import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PackageService } from './package.service';
import { PackageRepository } from './repository/package.repository';
import { PackageKafkaController } from './package.kafka.controller';
import { HttpToRpcExceptionInterceptor } from '../common/interceptors/http-to-rpc-exception';

@Module({
  imports: [PrismaModule],
  controllers: [PackageKafkaController],
  providers: [PackageService, PackageRepository, HttpToRpcExceptionInterceptor],
  exports: [PackageService],
})
export class PackageModule {}
