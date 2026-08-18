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
    this.client.subscribeToResponseOf('transaction.create');
    this.client.subscribeToResponseOf('transaction.get-by-reference');
    this.client.subscribeToResponseOf('transaction.get-balance');

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
}
