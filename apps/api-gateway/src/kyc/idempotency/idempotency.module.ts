import { Module } from '@nestjs/common';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyService } from './idempotency.service';
import { PrismaModule } from 'apps/kyc-service/src/database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IdempotencyRepository, IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
