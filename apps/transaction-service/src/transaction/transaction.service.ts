import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';

import { TransactionType } from 'apps/transaction-service/generated/prisma/enums';
import { RpcException } from '@nestjs/microservices';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeTransaction(transaction: any) {
    return {
      ...transaction,

      sequence:
        transaction.sequence !== undefined && transaction.sequence !== null
          ? transaction.sequence.toString()
          : undefined,

      amount:
        transaction.amount !== undefined && transaction.amount !== null
          ? transaction.amount.toString()
          : undefined,

      openingBalance:
        transaction.openingBalance !== undefined &&
        transaction.openingBalance !== null
          ? transaction.openingBalance.toString()
          : undefined,

      closingBalance:
        transaction.closingBalance !== undefined &&
        transaction.closingBalance !== null
          ? transaction.closingBalance.toString()
          : undefined,
    };
  }

  async getTransactionByReference(referenceId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: {
        referenceId,
      },
    });

    if (!transaction) {
      throw new RpcException({
        status: 404,
        message: `Transaction ${referenceId} not found`,
      });
    }

    return this.serializeTransaction(transaction);
  }

  async getCurrentBalance(
    userId: string,
    walletType: 'MAIN' | 'AEPS' | 'PROFIT',
  ) {
    const lastTransaction = await this.prisma.transaction.findFirst({
      where: {
        userId,
        walletType,
        status: 'SUCCESS',
      },
      orderBy: {
        sequence: 'desc',
      },
    });

    if (!lastTransaction) {
      return 0;
    }

    return Number(lastTransaction.closingBalance);
  }

  async createTransaction(dto: CreateTransactionDto) {
    if (
      typeof dto.amount !== 'number' ||
      !Number.isFinite(dto.amount) ||
      dto.amount < 0.01
    ) {
      throw new RpcException({
        status: 400,
        message: 'Transaction amount must be greater than 0',
      });
    }

    if (!dto.idempotencyKey || !dto.idempotencyKey.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Idempotency key is required',
      });
    }

    if (!['MAIN', 'AEPS', 'PROFIT'].includes(dto.walletType)) {
      throw new RpcException({
        status: 400,
        message: `Invalid wallet type: ${dto.walletType}`,
      });
    }
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: {
        userId: dto.userId,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    if (existingTransaction) {
      return this.serializeTransaction(existingTransaction);
    }

    const openingBalance = await this.getCurrentBalance(
      dto.userId,
      dto.walletType,
    );

    let closingBalance: number;

    if (dto.type === TransactionType.CREDIT) {
      closingBalance = openingBalance + dto.amount;
    } else {
      if (dto.amount > openingBalance) {
        throw new RpcException({
          status: 400,
          message: `Insufficient balance. Available balance: ₹${openingBalance}`,
        });
      }

      closingBalance = openingBalance - dto.amount;
    }

    const referenceId = `TXN-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    try {
      const transaction = await this.prisma.transaction.create({
        data: {
          referenceId,
          userId: dto.userId,
          walletType: dto.walletType,
          serviceType: dto.serviceType,
          type: dto.type,
          amount: dto.amount,
          openingBalance,
          closingBalance,
          status: 'SUCCESS',
          description: dto.description,
          externalReference: dto.externalReference,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      return this.serializeTransaction(transaction);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const transaction = await this.prisma.transaction.findFirst({
          where: {
            userId: dto.userId,
            idempotencyKey: dto.idempotencyKey,
          },
        });

        if (transaction) {
          return this.serializeTransaction(transaction);
        }

        throw new ConflictException('Transaction already exists');
      }

      throw error;
    }
  }

  async transferMoney(dto: TransferMoneyDto) {
    if (dto.senderUserId === dto.receiverUserId) {
      throw new RpcException({
        status: 400,
        message: 'Sender and receiver cannot be the same user',
      });
    }

    const existingTransaction = await this.prisma.transaction.findFirst({
      where: {
        userId: dto.senderUserId,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    if (existingTransaction) {
      return {
        senderTransaction: this.serializeTransaction(existingTransaction),
        duplicate: true,
      };
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const senderLastTransaction = await tx.transaction.findFirst({
          where: {
            userId: dto.senderUserId,
            walletType: dto.walletType,
            status: 'SUCCESS',
          },
          orderBy: {
            sequence: 'desc',
          },
        });

        const senderOpeningBalance = senderLastTransaction
          ? Number(senderLastTransaction.closingBalance)
          : 0;

        if (dto.amount > senderOpeningBalance) {
          throw new RpcException({
            status: 400,
            message: `Insufficient balance. Available balance: ₹${senderOpeningBalance}`,
          });
        }

        const senderClosingBalance = senderOpeningBalance - dto.amount;

        const receiverLastTransaction = await tx.transaction.findFirst({
          where: {
            userId: dto.receiverUserId,
            walletType: dto.walletType,
            status: 'SUCCESS',
          },
          orderBy: {
            sequence: 'desc',
          },
        });

        const receiverOpeningBalance = receiverLastTransaction
          ? Number(receiverLastTransaction.closingBalance)
          : 0;

        const receiverClosingBalance = receiverOpeningBalance + dto.amount;

        const transferReference = `TRANSFER-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        const senderReference = `TXN-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        const receiverReference = `TXN-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

        const senderTransaction = await tx.transaction.create({
          data: {
            referenceId: senderReference,
            userId: dto.senderUserId,
            walletType: dto.walletType,
            serviceType: 'WALLET_TO_WALLET',
            type: 'DEBIT',
            amount: dto.amount,
            openingBalance: senderOpeningBalance,
            closingBalance: senderClosingBalance,
            status: 'SUCCESS',
            description: dto.description ?? 'Wallet transfer',
            idempotencyKey: dto.idempotencyKey,
            externalReference: transferReference,
          },
        });

        const receiverTransaction = await tx.transaction.create({
          data: {
            referenceId: receiverReference,
            userId: dto.receiverUserId,
            walletType: dto.walletType,
            serviceType: 'WALLET_TO_WALLET',
            type: 'CREDIT',
            amount: dto.amount,
            openingBalance: receiverOpeningBalance,
            closingBalance: receiverClosingBalance,
            status: 'SUCCESS',
            description: dto.description ?? 'Wallet transfer',
            idempotencyKey: `${dto.idempotencyKey}-RECEIVER`,
            externalReference: transferReference,
          },
        });

        return {
          transferReference,
          senderTransaction,
          receiverTransaction,
        };
      });

      return {
        transferReference: result.transferReference,
        senderTransaction: this.serializeTransaction(result.senderTransaction),
        receiverTransaction: this.serializeTransaction(
          result.receiverTransaction,
        ),
      };
    } catch (error: any) {
      if (error instanceof RpcException) {
        throw error;
      }

      if (error?.code === 'P2002') {
        throw new RpcException({
          status: 409,
          message: 'Transfer already exists',
        });
      }

      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Transfer failed',
      });
    }
  }
}
