import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { firstValueFrom } from 'rxjs';

import { WALLET_PATTERNS } from '@nexus/common/wallet/wallet.patterns';

export const AEPS_WALLET_CLIENT = 'AEPS_WALLET_CLIENT';

@Injectable()
export class AepsWalletService implements OnModuleInit {
  constructor(
    @Inject(AEPS_WALLET_CLIENT)
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(WALLET_PATTERNS.SETTLE_AEPS_PRINCIPAL);
    this.client.subscribeToResponseOf(
      WALLET_PATTERNS.PREPARE_AEPS_CASH_DEPOSIT,
    );

    this.client.subscribeToResponseOf(
      WALLET_PATTERNS.CONFIRM_AEPS_CASH_DEPOSIT,
    );

    this.client.subscribeToResponseOf(
      WALLET_PATTERNS.COMPENSATE_AEPS_CASH_DEPOSIT,
    );
    this.client.subscribeToResponseOf(WALLET_PATTERNS.CREDIT_AEPS_COMMISSION);
    this.client.subscribeToResponseOf(
      WALLET_PATTERNS.CREDIT_COMMISSION_DISTRIBUTION,
    );
    await this.client.connect();
  }

  settlePrincipal(input: {
    userId: string;

    providerTransactionReference: string;

    operation: 'CW' | 'AP';

    grossAmount: number;

    netAmount: number;
  }) {
    return firstValueFrom(
      this.client.send(
        WALLET_PATTERNS.SETTLE_AEPS_PRINCIPAL,

        input,
      ),
    );
  }

  prepareCashDeposit(input: {
    userId: string;

    providerTransactionIdempotencyKey: string;

    merchantProfileId: string;

    providerMerchantId: string;

    amount: number;

    bankIIN: string;

    aadhaarLast4: string;
  }) {
    return firstValueFrom(
      this.client.send(
        WALLET_PATTERNS.PREPARE_AEPS_CASH_DEPOSIT,

        input,
      ),
    );
  }

  confirmCashDeposit(input: {
    userId: string;

    providerTransactionReference: string;
  }) {
    return firstValueFrom(
      this.client.send(
        WALLET_PATTERNS.CONFIRM_AEPS_CASH_DEPOSIT,

        input,
      ),
    );
  }

  compensateCashDeposit(input: {
    userId: string;

    providerTransactionReference: string;

    amount: number;
  }) {
    return firstValueFrom(
      this.client.send(
        WALLET_PATTERNS.COMPENSATE_AEPS_CASH_DEPOSIT,

        input,
      ),
    );
  }

  creditCommission(input: {
    userId: string;

    commissionId: string;

    commissionReference: string;

    providerTransactionReference: string;

    amount: number;

    serviceType: string;
  }) {
    return firstValueFrom(
      this.client.send(
        WALLET_PATTERNS.CREDIT_AEPS_COMMISSION,

        input,
      ),
    );
  }

  creditCommissionDistribution(input: {
    recipientUserId: string;

    recipientRole: string;

    commissionId: string;

    commissionReference: string;

    distributionTransactionId: string;

    amount: number;

    serviceType: string;

    idempotencyKey: string;
  }) {
    return firstValueFrom(
      this.client.send(
        WALLET_PATTERNS.CREDIT_COMMISSION_DISTRIBUTION,

        input,
      ),
    );
  }
}
