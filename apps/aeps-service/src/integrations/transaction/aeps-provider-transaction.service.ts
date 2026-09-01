import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { firstValueFrom } from 'rxjs';

import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';

import { CreateProviderTransactionDto } from '@nexus/common/transaction/dto/create-provider-transaction.dto';

import { FinalizeProviderTransactionDto } from '@nexus/common/transaction/dto/finalize-provider-transaction.dto';

import { MarkProviderTransactionUnknownDto } from '@nexus/common/transaction/dto/mark-provider-transaction-unknown.dto';

export const AEPS_TRANSACTION_CLIENT = 'AEPS_TRANSACTION_CLIENT';

@Injectable()
export class AepsProviderTransactionService implements OnModuleInit {
  constructor(
    @Inject(AEPS_TRANSACTION_CLIENT)
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.CREATE_PROVIDER_TRANSACTION,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.MARK_PROVIDER_TRANSACTION_PROCESSING,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.FINALIZE_PROVIDER_TRANSACTION,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.MARK_PROVIDER_TRANSACTION_UNKNOWN,
    );
    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.UPDATE_PROVIDER_COMMISSION_STATE,
    );

    await this.client.connect();
  }

  create(dto: CreateProviderTransactionDto) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.CREATE_PROVIDER_TRANSACTION,

        dto,
      ),
    );
  }

  markProcessing(referenceId: string, providerMerchantRefId: string) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.MARK_PROVIDER_TRANSACTION_PROCESSING,

        {
          referenceId,

          providerMerchantRefId,
        },
      ),
    );
  }

  finalize(dto: FinalizeProviderTransactionDto) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.FINALIZE_PROVIDER_TRANSACTION,

        dto,
      ),
    );
  }

  markUnknown(dto: MarkProviderTransactionUnknownDto) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.MARK_PROVIDER_TRANSACTION_UNKNOWN,

        dto,
      ),
    );
  }

  updateCommissionState(input: {
    referenceId: string;

    status: 'NOT_REQUIRED' | 'PENDING' | 'SETTLED' | 'FAILED';

    commissionReferenceId?: string;

    commissionWalletTransactionReference?: string;

    commissionAmount?: number;

    failureReason?: string;
  }) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.UPDATE_PROVIDER_COMMISSION_STATE,

        input,
      ),
    );
  }
}
