import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';
import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TransactionGatewayService implements OnModuleInit {
  constructor(
    @Inject('TRANSACTION_SERVICE')
    private readonly client: ClientKafka,
  ) {}
  async onModuleInit() {
    this.client.subscribeToResponseOf(TRANSACTION_PATTERNS.CREATE);
    this.client.subscribeToResponseOf(TRANSACTION_PATTERNS.GET_BY_REFERENCE);
    this.client.subscribeToResponseOf(TRANSACTION_PATTERNS.GET_BALANCE);
    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.GET_PROVIDER_TRANSACTION,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.LIST_PROVIDER_TRANSACTIONS,
    );
    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.LIST_RECONCILIATION_QUEUE,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.RESOLVE_PROVIDER_TRANSACTION,
    );

    this.client.subscribeToResponseOf(
      TRANSACTION_PATTERNS.REQUEST_PROVIDER_TRANSACTION_REVERSAL,
    );

    await this.client.connect();
  }

  async createTransaction(dto: CreateTransactionDto) {
    try {
      return await firstValueFrom(
        this.client.send(TRANSACTION_PATTERNS.CREATE, dto),
      );
    } catch (error: any) {
      throw this.handleKafkaError(error);
    }
  }

  async getBalance(userId: string, walletType: 'MAIN' | 'AEPS' | 'PROFIT') {
    try {
      return await firstValueFrom(
        this.client.send(TRANSACTION_PATTERNS.GET_BALANCE, {
          userId,
          walletType,
        }),
      );
    } catch (error: any) {
      throw this.handleKafkaError(error);
    }
  }

  async getTransactionByReference(referenceId: string) {
    try {
      return await firstValueFrom(
        this.client.send(TRANSACTION_PATTERNS.GET_BY_REFERENCE, {
          referenceId,
        }),
      );
    } catch (error: any) {
      throw this.handleKafkaError(error);
    }
  }

  private handleKafkaError(error: any): Error {
    const statusCode = Number(error?.statusCode ?? 500);

    const message =
      typeof error?.message === 'string'
        ? error.message
        : 'Internal server error';

    switch (statusCode) {
      case 400:
        return new BadRequestException(message);

      case 404:
        return new NotFoundException(message);

      case 409:
        return new ConflictException(message);

      default:
        return new InternalServerErrorException(message);
    }
  }

  getProviderTransaction(userId: string, referenceId: string) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.GET_PROVIDER_TRANSACTION,

        {
          userId,
          referenceId,
        },
      ),
    );
  }

  listProviderTransactions(
    userId: string,

    query: {
      provider?: string;
      serviceType?: string;
      operation?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.LIST_PROVIDER_TRANSACTIONS,

        {
          userId,
          ...query,
        },
      ),
    );
  }

  listProviderReconciliationQueue(query: {
    provider?: string;

    serviceType?: string;

    operation?: string;

    status?: 'PENDING' | 'UNKNOWN';

    page?: number;

    limit?: number;
  }) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.LIST_RECONCILIATION_QUEUE,

        query,
      ),
    );
  }

  resolveProviderTransaction(
    referenceId: string,

    resolvedBy: string,

    dto: {
      resolution: 'SUCCESS' | 'FAILED';

      note?: string;

      providerTxnRefId?: string;

      rrn?: string;

      npciCode?: string;

      npciMessage?: string;
    },
  ) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.RESOLVE_PROVIDER_TRANSACTION,

        {
          referenceId,

          resolvedBy,

          ...dto,
        },
      ),
    );
  }

  requestProviderTransactionReversal(
    referenceId: string,

    requestedBy: string,

    reason: string,

    idempotencyKey: string,
  ) {
    return firstValueFrom(
      this.client.send(
        TRANSACTION_PATTERNS.REQUEST_PROVIDER_TRANSACTION_REVERSAL,

        {
          referenceId,

          requestedBy,

          reason,

          idempotencyKey,
        },
      ),
    );
  }
}
