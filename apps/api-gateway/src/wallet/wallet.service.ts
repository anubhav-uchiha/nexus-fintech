import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AddMoneyDto } from '@nexus/common/transaction/dto/add-money.dto';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';
import { WALLET_PATTERNS } from '@nexus/common/wallet/wallet.patterns';
import { CalculateCommissionDto } from '@nexus/common/commission/dto/calculate-commission.dto';

@Injectable()
export class WalletGatewayService implements OnModuleInit {
  constructor(
    @Inject('WALLET_SERVICE')
    private readonly walletClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.walletClient.subscribeToResponseOf(WALLET_PATTERNS.ADD_MONEY);

    this.walletClient.subscribeToResponseOf(WALLET_PATTERNS.GET_BALANCES);

    this.walletClient.subscribeToResponseOf(WALLET_PATTERNS.TRANSFER);

    this.walletClient.subscribeToResponseOf(
      WALLET_PATTERNS.CALCULATE_COMMISSION,
    );

    await this.walletClient.connect();
  }

  async addMoney(dto: AddMoneyDto) {
    try {
      return await firstValueFrom(
        this.walletClient.send(WALLET_PATTERNS.ADD_MONEY, {
          dto,
          role: 'RETAILER',
        }),
      );
    } catch (error: any) {
      throw this.handleRpcError(error, 'Unable to add money');
    }
  }

  async getBalances(userId: string) {
    try {
      return await firstValueFrom(
        this.walletClient.send(WALLET_PATTERNS.GET_BALANCES, {
          userId,
        }),
      );
    } catch (error: any) {
      throw this.handleRpcError(error, 'Unable to fetch wallet balances');
    }
  }

  async transferMoney(dto: TransferMoneyDto) {
    try {
      return await firstValueFrom(
        this.walletClient.send(WALLET_PATTERNS.TRANSFER, dto),
      );
    } catch (error: any) {
      throw this.handleRpcError(error, 'Unable to transfer money');
    }
  }

  private handleRpcError(error: any, fallbackMessage: string): HttpException {
    console.error('RPC ERROR:', error);

    let rpcError = error;

    if (error?.error !== undefined) {
      rpcError = error.error;
    }

    if (typeof rpcError === 'string') {
      try {
        rpcError = JSON.parse(rpcError);
      } catch {}
    }

    if (
      rpcError &&
      typeof rpcError === 'object' &&
      rpcError.error !== undefined
    ) {
      rpcError = rpcError.error;

      if (typeof rpcError === 'string') {
        try {
          rpcError = JSON.parse(rpcError);
        } catch {}
      }
    }

    const statusCode =
      Number(rpcError?.status) ||
      Number(rpcError?.statusCode) ||
      Number(error?.status) ||
      Number(error?.statusCode) ||
      500;

    const message = rpcError?.message || error?.message || fallbackMessage;

    return new HttpException(message, statusCode);
  }
  async calculateCommission(dto: CalculateCommissionDto) {
    try {
      return firstValueFrom(
        this.walletClient.send(WALLET_PATTERNS.CALCULATE_COMMISSION, dto),
      );
    } catch (error: any) {
      throw this.handleRpcError(error, 'Unable to calculate commission');
    }
  }
}
