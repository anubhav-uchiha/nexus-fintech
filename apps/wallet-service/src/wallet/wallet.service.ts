import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';
import { AddMoneyDto } from '@nexus/common/transaction/dto/add-money.dto';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';

@Injectable()
export class WalletService implements OnModuleInit {
  constructor(
    @Inject('TRANSACTION_SERVICE')
    private readonly transactionClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.transactionClient.subscribeToResponseOf(
      TRANSACTION_PATTERNS.GET_BALANCE,
    );

    this.transactionClient.subscribeToResponseOf(TRANSACTION_PATTERNS.CREATE);

    this.transactionClient.subscribeToResponseOf(TRANSACTION_PATTERNS.TRANSFER);
  }

  async addMoney(dto: AddMoneyDto) {
    return firstValueFrom(
      this.transactionClient.send(TRANSACTION_PATTERNS.CREATE, {
        userId: dto.userId,
        walletType: dto.walletType,
        serviceType: 'ADD_MONEY',
        type: 'CREDIT',
        amount: dto.amount,
        description: dto.description ?? 'Wallet Add Money',
        externalReference: dto.externalReference,
        idempotencyKey: dto.idempotencyKey,
      }),
    );
  }

  async getBalances(userId: string) {
    const [main, aeps, profit] = await Promise.all([
      firstValueFrom(
        this.transactionClient.send(TRANSACTION_PATTERNS.GET_BALANCE, {
          userId,
          walletType: 'MAIN',
        }),
      ),

      firstValueFrom(
        this.transactionClient.send(TRANSACTION_PATTERNS.GET_BALANCE, {
          userId,
          walletType: 'AEPS',
        }),
      ),

      firstValueFrom(
        this.transactionClient.send(TRANSACTION_PATTERNS.GET_BALANCE, {
          userId,
          walletType: 'PROFIT',
        }),
      ),
    ]);

    return {
      userId,
      wallets: {
        main: Number(main ?? 0),
        aeps: Number(aeps ?? 0),
        profit: Number(profit ?? 0),
      },
    };
  }
  async transferMoney(dto: TransferMoneyDto) {
    try {
      return await firstValueFrom(
        this.transactionClient.send(TRANSACTION_PATTERNS.TRANSFER, dto),
      );
    } catch (error: any) {
      console.error('TRANSACTION SERVICE ERROR:', error);

      let rpcError = error;

      if (error?.error !== undefined) {
        rpcError = error.error;
      }

      if (typeof rpcError === 'string') {
        try {
          rpcError = JSON.parse(rpcError);
        } catch {
          // keep string
        }
      }

      const status =
        Number(rpcError?.status) || Number(rpcError?.statusCode) || 500;

      const message = rpcError?.message || error?.message || 'Transfer failed';

      throw new RpcException({
        status,
        message,
      });
    }
  }
}
