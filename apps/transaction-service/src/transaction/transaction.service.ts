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
import { createHash, randomUUID } from 'crypto';
import { Prisma } from 'apps/transaction-service/generated/prisma/client';

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
    return `${prefix}-${randomUUID()}`;
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

  private validatePeerTransfer(dto: TransferMoneyDto): void {
    this.validateAmount(dto.amount);

    if (!dto.senderUserId) {
      this.throwRpc(400, 'Sender user ID is required');
    }

    if (!dto.receiverUserId) {
      this.throwRpc(400, 'Receiver user ID is required');
    }

    if (dto.senderUserId === dto.receiverUserId) {
      this.throwRpc(400, 'Sender and receiver cannot be the same user');
    }

    if (!dto.senderLoginId?.trim()) {
      this.throwRpc(400, 'Sender login ID is required');
    }

    if (!dto.receiverLoginId?.trim()) {
      this.throwRpc(400, 'Receiver login ID is required');
    }

    if (dto.walletType !== WalletType.MAIN) {
      this.throwRpc(
        400,
        'Peer transfers are allowed only from the MAIN wallet',
      );
    }

    if (dto.senderRole !== dto.receiverRole) {
      this.throwRpc(403, 'Sender and receiver must have the same role');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
    }
  }

  private createReceiverIdempotencyKey(dto: TransferMoneyDto): string {
    return createHash('sha256')
      .update(
        [
          'PEER_TRANSFER_RECEIVER',
          dto.senderUserId,
          dto.receiverUserId,
          dto.idempotencyKey,
        ].join(':'),
      )
      .digest('hex');
  }

  private async findExistingPeerTransfer(
    dto: TransferMoneyDto,
    amount: Prisma.Decimal,
  ) {
    const senderTransaction = await this.prisma.transaction.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: dto.senderUserId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });

    if (!senderTransaction) {
      return null;
    }

    if (
      senderTransaction.serviceType !== 'PEER_TRANSFER' ||
      senderTransaction.walletType !== WalletType.MAIN ||
      senderTransaction.type !== TransactionType.DEBIT ||
      !senderTransaction.amount.equals(amount)
    ) {
      this.throwRpc(
        409,
        'Idempotency key was already used for a different transaction',
      );
    }

    if (!senderTransaction.externalReference) {
      this.throwRpc(409, 'Existing transfer record is incomplete');
    }

    const receiverTransaction = await this.prisma.transaction.findFirst({
      where: {
        externalReference: senderTransaction.externalReference,
        userId: dto.receiverUserId,
        walletType: WalletType.MAIN,
        serviceType: 'PEER_TRANSFER',
        type: TransactionType.CREDIT,
      },
    });

    if (!receiverTransaction || !receiverTransaction.amount.equals(amount)) {
      this.throwRpc(
        409,
        'Idempotency key was already used with different transfer details',
      );
    }

    return {
      duplicate: true,
      transferReference: senderTransaction.externalReference,

      senderTransaction: this.serializeTransaction(senderTransaction),

      receiverTransaction: this.serializeTransaction(receiverTransaction),
    };
  }

  async transferMoney(dto: TransferMoneyDto) {
    this.validatePeerTransfer(dto);
    const amount = new Prisma.Decimal(dto.amount.toString());

    const existingTransfer = await this.findExistingPeerTransfer(dto, amount);

    if (existingTransfer) {
      return existingTransfer;
    }

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const walletLocks = [
            `${dto.senderUserId}:${WalletType.MAIN}`,
            `${dto.receiverUserId}:${WalletType.MAIN}`,
          ].sort();

          for (const walletLock of walletLocks) {
            await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${walletLock}, 0)
            )
          `;
          }
          const duplicateSender = await tx.transaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: dto.senderUserId,
                idempotencyKey: dto.idempotencyKey,
              },
            },
          });

          if (duplicateSender) {
            if (
              duplicateSender.serviceType !== 'PEER_TRANSFER' ||
              duplicateSender.walletType !== WalletType.MAIN ||
              duplicateSender.type !== TransactionType.DEBIT ||
              !duplicateSender.amount.equals(amount) ||
              !duplicateSender.externalReference
            ) {
              this.throwRpc(
                409,
                'Idempotency key was already used for a different transaction',
              );
            }

            const duplicateReceiver = await tx.transaction.findFirst({
              where: {
                externalReference: duplicateSender.externalReference,
                userId: dto.receiverUserId,
                walletType: WalletType.MAIN,
                serviceType: 'PEER_TRANSFER',
                type: TransactionType.CREDIT,
              },
            });

            if (
              !duplicateReceiver ||
              !duplicateReceiver.amount.equals(amount)
            ) {
              this.throwRpc(
                409,
                'Idempotency key was already used with different transfer details',
              );
            }

            return {
              duplicate: true,
              transferReference: duplicateSender.externalReference,
              senderTransaction: duplicateSender,
              receiverTransaction: duplicateReceiver,
            };
          }

          const senderLastTransaction = await tx.transaction.findFirst({
            where: {
              userId: dto.senderUserId,
              walletType: WalletType.MAIN,
              status: 'SUCCESS',
            },
            orderBy: {
              sequence: 'desc',
            },
          });

          const senderOpeningBalance =
            senderLastTransaction?.closingBalance ?? new Prisma.Decimal(0);

          if (amount.greaterThan(senderOpeningBalance)) {
            this.throwRpc(
              400,
              `Insufficient balance. Available balance: ₹${senderOpeningBalance.toFixed(
                2,
              )}`,
            );
          }

          const senderClosingBalance = senderOpeningBalance.minus(amount);

          const receiverLastTransaction = await tx.transaction.findFirst({
            where: {
              userId: dto.receiverUserId,
              walletType: WalletType.MAIN,
              status: 'SUCCESS',
            },
            orderBy: {
              sequence: 'desc',
            },
          });

          const receiverOpeningBalance =
            receiverLastTransaction?.closingBalance ?? new Prisma.Decimal(0);

          const receiverClosingBalance = receiverOpeningBalance.plus(amount);

          const transferReference = this.generateReference('PEER-TRANSFER');

          const senderTransaction = await tx.transaction.create({
            data: {
              referenceId: this.generateReference('TXN'),
              userId: dto.senderUserId,
              walletType: WalletType.MAIN,
              serviceType: 'PEER_TRANSFER',
              type: TransactionType.DEBIT,
              amount,
              openingBalance: senderOpeningBalance,
              closingBalance: senderClosingBalance,
              status: 'SUCCESS',
              description: `Transferred to ${dto.receiverLoginId}`,
              idempotencyKey: dto.idempotencyKey,
              externalReference: transferReference,
              metadata: {
                senderLoginId: dto.senderLoginId,
                receiverLoginId: dto.receiverLoginId,
                senderRole: dto.senderRole,
                receiverRole: dto.receiverRole,
              },
            },
          });

          const receiverTransaction = await tx.transaction.create({
            data: {
              referenceId: this.generateReference('TXN'),
              userId: dto.receiverUserId,
              walletType: WalletType.MAIN,
              serviceType: 'PEER_TRANSFER',
              type: TransactionType.CREDIT,
              amount,
              openingBalance: receiverOpeningBalance,
              closingBalance: receiverClosingBalance,
              status: 'SUCCESS',
              description: `Received from ${dto.senderLoginId}`,
              idempotencyKey: this.createReceiverIdempotencyKey(dto),
              externalReference: transferReference,
              metadata: {
                senderLoginId: dto.senderLoginId,
                receiverLoginId: dto.receiverLoginId,
                senderRole: dto.senderRole,
                receiverRole: dto.receiverRole,
              },
            },
          });

          return {
            duplicate: false,
            transferReference,
            senderTransaction,
            receiverTransaction,
          };
        },
        {
          isolationLevel: 'Serializable',
        },
      );

      return {
        duplicate: result.duplicate,
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
        const duplicate = await this.findExistingPeerTransfer(dto, amount);

        if (duplicate) {
          return duplicate;
        }

        this.throwRpc(409, 'Transfer already exists');
      }

      if (error?.code === 'P2034') {
        this.throwRpc(409, 'Transfer conflict. Please retry the transaction.');
      }

      this.throwRpc(500, error?.message ?? 'Peer transfer failed');
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

          const openingBalance =
            lastTransaction?.closingBalance ?? new Prisma.Decimal(0);

          const commissionAmount = new Prisma.Decimal(dto.amount.toString());

          if (commissionAmount.greaterThan(openingBalance)) {
            throw new RpcException({
              status: 400,
              message:
                `Insufficient balance for commission. ` +
                `Available balance: ₹${openingBalance.toFixed(2)}`,
            });
          }

          const closingBalance = openingBalance.minus(commissionAmount);

          return tx.transaction.create({
            data: {
              referenceId: this.generateReference('COMM-TXN'),
              userId: dto.userId,
              walletType: dto.walletType,
              serviceType: dto.serviceType,
              type: TransactionType.DEBIT,
              amount: commissionAmount,
              openingBalance,
              closingBalance,
              status: 'SUCCESS',
              description: dto.description,
              externalReference: dto.commissionId,
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
