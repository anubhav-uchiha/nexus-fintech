import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../database/prisma.module';

import { VimopayModule } from '../vimopay.module';

import { VimopayTransactionAccessService } from './vimopay-transaction-access.service';

import { VimopayTransactionService } from './vimopay-transaction.service';

import { VimopayTransactionDebugController } from './vimopay-transaction-debug.controller';
import { VimopayIdempotencyService } from './vimopay-idempotency.service';
import { AepsIntegrationsModule } from '../../../integrations/aeps-integrations.module';
import { VimopayTxnAuthCleanupService } from './vimopay-txn-auth-cleanup.service';
@Module({
  imports: [
    PrismaModule,

    /*
     * Existing tested low-level
     * VimoPay provider APIs.
     */
    VimopayModule,
    AepsIntegrationsModule,
  ],

  controllers: [VimopayTransactionDebugController],

  providers: [
    VimopayTransactionAccessService,
    VimopayIdempotencyService,
    VimopayTxnAuthCleanupService,
    VimopayTransactionService,
  ],

  exports: [VimopayTransactionAccessService, VimopayTransactionService],
})
export class VimopayTransactionModule {}
