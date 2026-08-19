import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';

import {
  TransactionType,
  WalletType,
} from 'apps/transaction-service/generated/prisma/enums';
import { RpcException } from '@nestjs/microservices';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';
import { CreateCommissionTransactionDto } from '@nexus/common/transaction/dto/create-commission-transaction.dto';
// import { NotFoundError } from 'libs/errors/ApiError';

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

  private throwRpc(status: number, message: string): never {
    throw new RpcException({ status, message });
  }

  private validateWalletType(
    walletType: string,
  ): asserts walletType is WalletType {
    if (!['MAIN', 'AEPS', 'PROFIT'].includes(walletType)) {
      this.throwRpc(400, `Invalid wallet type: ${walletType}`);
    }
  }

  private validateAmount(amount: unknown): asserts amount is number {
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 0.01
    ) {
      this.throwRpc(400, 'Transaction amount must be greater than 0');
    }
  }

  private generateReference(prefix = 'TXN'): string {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
  }

  async getTransactionByReference(referenceId: string) {
    if (!referenceId?.trim()) {
      this.throwRpc(400, 'Transaction referenceId is required');
    }
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

      // throw new NotFoundError(`Transaction ${referenceId} not found`);
    }

    return this.serializeTransaction(transaction);
  }

  async getCurrentBalance(userId: string, walletType: WalletType) {
    this.validateWalletType(walletType);

    if (!userId) {
      this.throwRpc(400, 'User ID is required');
    }
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
    this.validateAmount(dto.amount);
    this.validateWalletType(dto.walletType);

    if (!dto.userId) {
      this.throwRpc(400, 'User ID is required');
    }
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

    if (!dto.serviceType?.trim()) {
      this.throwRpc(400, 'Service type is required');
    }

    if (
      dto.type !== TransactionType.CREDIT &&
      dto.type !== TransactionType.DEBIT
    ) {
      this.throwRpc(400, `Invalid transaction type: ${dto.type}`);
    }

    const existingTransaction = await this.prisma.transaction.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: dto.userId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });

    if (existingTransaction) {
      return this.serializeTransaction(existingTransaction);
    }

    try {
      const transaction = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${`${dto.userId}:${dto.walletType}`},
              0
            )
          )::text
        `;
          const duplicate = await tx.transaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: dto.userId,
                idempotencyKey: dto.idempotencyKey,
              },
            },
          });

          if (duplicate) {
            return duplicate;
          }

          const lastTransaction = await tx.transaction.findFirst({
            where: {
              userId: dto.userId,
              walletType: dto.walletType,
              status: 'SUCCESS',
            },
            orderBy: {
              sequence: 'desc',
            },
          });

          const openingBalance = lastTransaction
            ? Number(lastTransaction.closingBalance)
            : 0;

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

          const referenceId = this.generateReference('TXN');

          return await tx.transaction.create({
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
        },
        {
          isolationLevel: 'Serializable',
        },
      );

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
      if (error?.code === 'P2034') {
        throw new RpcException({
          status: 409,
          message: 'Transaction conflict. Please retry the transaction.',
        });
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Transaction creation failed',
      });
    }
  }

  async transferMoney(dto: TransferMoneyDto) {
    this.validateAmount(dto.amount);
    this.validateWalletType(dto.walletType);

    if (!dto.senderUserId) {
      this.throwRpc(400, 'Sender user ID is required');
    }

    if (!dto.receiverUserId) {
      this.throwRpc(400, 'Receiver user ID is required');
    }
    if (dto.senderUserId === dto.receiverUserId) {
      throw new RpcException({
        status: 400,
        message: 'Sender and receiver cannot be the same user',
      });
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
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
        const walletLocks = [
          `${dto.senderUserId}:${dto.walletType}`,
          `${dto.receiverUserId}:${dto.walletType}`,
        ].sort();

        for (const walletLock of walletLocks) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${walletLock},0))`;
        }
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

        const transferReference = this.generateReference('TRANSFER');

        const senderReference = this.generateReference('TXN');

        const receiverReference = this.generateReference('TXN');

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
        duplicate: false,
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

  async createCommissionTransaction(dto: CreateCommissionTransactionDto) {
    this.validateWalletType(dto.walletType);
    this.validateAmount(dto.amount);

    if (!dto.userId) {
      this.throwRpc(400, 'User is required');
    }
    if (!dto.commissionId?.trim()) {
      this.throwRpc(400, 'Commission ID is required');
    }

    if (!dto.originalTransactionId?.trim()) {
      this.throwRpc(400, 'Original transaction ID is required');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
    }

    const existingTransaction = await this.prisma.transaction.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: dto.userId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });

    if (existingTransaction) {
      return this.serializeTransaction(existingTransaction);
    }
    try {
      const transaction = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${`${dto.userId}:${dto.walletType}`},
              0
            )
          )
        `;

          const duplicate = await tx.transaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: dto.userId,
                idempotencyKey: dto.idempotencyKey,
              },
            },
          });

          if (duplicate) {
            return duplicate;
          }

          const lastTransaction = await tx.transaction.findFirst({
            where: {
              userId: dto.userId,
              walletType: dto.walletType,
              status: 'SUCCESS',
            },
            orderBy: {
              sequence: 'desc',
            },
          });

          const openingBalance = lastTransaction
            ? Number(lastTransaction.closingBalance)
            : 0;

          if (dto.amount > openingBalance) {
            throw new RpcException({
              status: 400,
              message: `Insufficient balance for commission. Available balance: ₹${openingBalance}`,
            });
          }

          const closingBalance = openingBalance - dto.amount;

          const referenceId = this.generateReference('COMM-TXN');

          const transaction = await tx.transaction.create({
            data: {
              referenceId,
              userId: dto.userId,
              walletType: dto.walletType,
              serviceType: dto.serviceType,
              type: 'DEBIT',
              amount: dto.amount,
              openingBalance,
              closingBalance,
              status: 'SUCCESS',
              description: dto.description,
              externalReference: dto.commissionId,
              idempotencyKey: dto.idempotencyKey,
            },
          });

          return transaction;
        },
        {
          isolationLevel: 'Serializable',
        },
      );

      return this.serializeTransaction(transaction);
    } catch (error: any) {
      if (error instanceof RpcException) {
        throw error;
      }

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

        throw new RpcException({
          status: 409,
          message: 'Commission transaction already exists',
        });
      }

      if (error?.code === 'P2034') {
        throw new RpcException({
          status: 409,
          message: 'Transaction conflict. Please retry.',
        });
      }

      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Commission transaction creation failed',
      });
    }
  }
}
