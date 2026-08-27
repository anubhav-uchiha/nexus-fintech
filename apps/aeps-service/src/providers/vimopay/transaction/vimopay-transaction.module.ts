import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../database/prisma.module';

import { VimopayModule } from '../vimopay.module';

import { VimopayTransactionAccessService } from './vimopay-transaction-access.service';

import { VimopayTransactionService } from './vimopay-transaction.service';

import { VimopayTransactionDebugController } from './vimopay-transaction-debug.controller';
import { VimopayIdempotencyService } from './vimopay-idempotency.service';

@Module({
  imports: [
    PrismaModule,

    /*
     * Existing tested low-level
     * VimoPay provider APIs.
     */
    VimopayModule,
  ],

  controllers: [VimopayTransactionDebugController],

  providers: [
    VimopayTransactionAccessService,
    VimopayIdempotencyService,
    VimopayTransactionService,
  ],

  exports: [VimopayTransactionAccessService, VimopayTransactionService],
})
export class VimopayTransactionModule {}
