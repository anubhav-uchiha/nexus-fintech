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
import { CreateProviderTransactionDto } from '@nexus/common/transaction/dto/create-provider-transaction.dto';
import { FinalizeProviderTransactionDto } from '@nexus/common/transaction/dto/finalize-provider-transaction.dto';
import { MarkProviderTransactionUnknownDto } from '@nexus/common/transaction/dto/mark-provider-transaction-unknown.dto';
import { ListProviderTransactionsDto } from '@nexus/common/transaction/dto/list-provider-transactions.dto';

import { ListProviderReconciliationDto } from '@nexus/common/transaction/dto/list-provider-reconciliation.dto';

import { ResolveProviderTransactionDto } from '@nexus/common/transaction/dto/resolve-provider-transaction.dto';

import { RequestProviderTransactionReversalDto } from '@nexus/common/transaction/dto/request-provider-transaction-reversal.dto';

import { PostProviderWalletEntryDto } from '@nexus/common/transaction/dto/post-provider-wallet-entry.dto';

import { PrepareProviderWalletDebitDto } from '@nexus/common/transaction/dto/prepare-provider-wallet-debit.dto';
import { ConfirmProviderWalletReservationDto } from '@nexus/common/transaction/dto/confirm-provider-wallet-reservation.dto';
import { UpdateProviderCommissionStateDto } from '@nexus/common/transaction/dto/update-provider-commission-state.dto';

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

  private throwRpc(statusCode: number, message: string): never {
    throw new RpcException({
      statusCode,
      message,
    });
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
        statusCode: 404,
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
        statusCode: 400,
        message: 'Transaction amount must be greater than 0',
      });
    }

    if (!dto.idempotencyKey || !dto.idempotencyKey.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Idempotency key is required',
      });
    }

    if (!['MAIN', 'AEPS', 'PROFIT'].includes(dto.walletType)) {
      throw new RpcException({
        statusCode: 400,
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
                statusCode: 400,
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
          statusCode: 409,
          message: 'Transaction conflict. Please retry the transaction.',
        });
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,
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
              statusCode: 400,
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
          statusCode: 409,
          message: 'Commission transaction already exists',
        });
      }

      if (error?.code === 'P2034') {
        throw new RpcException({
          statusCode: 409,
          message: 'Transaction conflict. Please retry.',
        });
      }

      throw new RpcException({
        statusCode: 500,
        message: error?.message ?? 'Commission transaction creation failed',
      });
    }
  }

  async createProviderTransaction(dto: CreateProviderTransactionDto) {
    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    if (!dto.serviceType?.trim()) {
      this.throwRpc(400, 'Service type is required');
    }

    if (!dto.provider?.trim()) {
      this.throwRpc(400, 'Provider is required');
    }

    if (!dto.operation?.trim()) {
      this.throwRpc(400, 'Provider operation is required');
    }

    if (
      typeof dto.amount !== 'number' ||
      !Number.isFinite(dto.amount) ||
      dto.amount < 0
    ) {
      this.throwRpc(400, 'Provider transaction amount is invalid');
    }

    /*
     * Financial request ka same Idempotency-Key
     * already record hua ho to wahi record return.
     */
    if (dto.idempotencyKey) {
      const existing = await this.prisma.providerTransaction.findUnique({
        where: {
          idempotencyKey: dto.idempotencyKey,
        },
      });

      if (existing) {
        /*
         * Same idempotency key sirf exactly
         * same provider transaction intent
         * ke liye reusable hai.
         */
        if (
          existing.userId !== dto.userId ||
          existing.provider !== dto.provider ||
          existing.operation !== dto.operation ||
          Number(existing.amount) !== dto.amount
        ) {
          this.throwRpc(
            409,
            'Provider transaction idempotency key has already been used for a different transaction',
          );
        }

        return existing;
      }
    }

    const referenceId = this.generateReference('PTXN');

    try {
      return await this.prisma.providerTransaction.create({
        data: {
          referenceId,

          userId: dto.userId,

          serviceType: dto.serviceType,

          provider: dto.provider,

          operation: dto.operation,

          amount: dto.amount,

          status: 'INITIATED',

          idempotencyKey: dto.idempotencyKey,

          merchantProfileId: dto.merchantProfileId,

          providerMerchantId: dto.providerMerchantId,

          bankIIN: dto.bankIIN,

          aadhaarLast4: dto.aadhaarLast4,

          settlementStatus: dto.settlementRequired ? 'PENDING' : 'NOT_REQUIRED',

          ...(dto.metadata !== undefined
            ? {
                metadata: dto.metadata as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002' && dto.idempotencyKey) {
        const existing = await this.prisma.providerTransaction.findUnique({
          where: {
            idempotencyKey: dto.idempotencyKey,
          },
        });

        if (existing) {
          if (
            existing.userId !== dto.userId ||
            existing.provider !== dto.provider ||
            existing.operation !== dto.operation ||
            Number(existing.amount) !== dto.amount
          ) {
            this.throwRpc(
              409,
              'Provider transaction idempotency key has already been used for a different transaction',
            );
          }

          return existing;
        }
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Unable to create provider transaction',
      });
    }
  }

  async markProviderTransactionProcessing(
    referenceId: string,
    providerMerchantRefId: string,
  ) {
    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * Already terminal record ko
     * PROCESSING par wapas nahi le jayenge.
     */
    if (
      ['SUCCESS', 'FAILED', 'PENDING', 'UNKNOWN', 'REVERSED'].includes(
        transaction.status,
      )
    ) {
      return transaction;
    }

    return this.prisma.providerTransaction.update({
      where: {
        referenceId,
      },

      data: {
        status: 'PROCESSING',

        providerMerchantRefId,

        providerCalledAt: new Date(),

        needsReconciliation: false,

        reconciliationReason: null,
      },
    });
  }

  async finalizeProviderTransaction(dto: FinalizeProviderTransactionDto) {
    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId: dto.referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    const isPending = dto.status === 'PENDING';

    return this.prisma.providerTransaction.update({
      where: {
        referenceId: dto.referenceId,
      },

      data: {
        status: dto.status,

        providerMerchantRefId: dto.providerMerchantRefId,

        providerTxnRefId: dto.providerTxnRefId,

        rrn: dto.rrn,

        npciCode: dto.npciCode,

        npciMessage: dto.npciMessage,

        providerStatusCode: dto.providerStatusCode,

        providerStatusMessage: dto.providerStatusMessage,

        ...(dto.metadata !== undefined
          ? {
              metadata: dto.metadata as Prisma.InputJsonValue,
            }
          : {}),

        /*
         * PENDING terminal state nahi hai.
         */
        needsReconciliation: isPending,

        reconciliationReason: isPending
          ? (
              dto.providerStatusMessage ?? 'Provider transaction is pending'
            ).slice(0, 500)
          : null,

        /*
         * SUCCESS / FAILED complete hain.
         *
         * PENDING abhi complete nahi.
         */
        completedAt: isPending ? null : new Date(),

        settlementStatus:
          dto.status === 'FAILED' && transaction.settlementStatus === 'PENDING'
            ? 'NOT_REQUIRED'
            : transaction.settlementStatus,
      },
    });
  }

  async markProviderTransactionUnknown(dto: MarkProviderTransactionUnknownDto) {
    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId: dto.referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * Already definitive response aa chuki
     * hai to UNKNOWN par downgrade nahi karenge.
     */
    if (
      transaction.status === 'SUCCESS' ||
      transaction.status === 'FAILED' ||
      transaction.status === 'REVERSED'
    ) {
      return transaction;
    }

    const reason = dto.reason ?? 'Provider transaction status is unknown';

    return this.prisma.providerTransaction.update({
      where: {
        referenceId: dto.referenceId,
      },

      data: {
        status: 'UNKNOWN',

        providerMerchantRefId: dto.providerMerchantRefId,

        providerStatusMessage: reason.slice(0, 500),

        needsReconciliation: true,

        reconciliationReason: reason.slice(0, 500),

        completedAt: null,
      },
    });
  }

  async getProviderTransaction(referenceId: string, userId?: string) {
    if (!referenceId?.trim()) {
      this.throwRpc(400, 'Provider transaction reference is required');
    }

    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * Public/user call mein ownership
     * verify hogi.
     */
    if (userId && transaction.userId !== userId) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    return {
      id: transaction.id,

      referenceId: transaction.referenceId,

      serviceType: transaction.serviceType,

      provider: transaction.provider,

      operation: transaction.operation,

      amount: transaction.amount.toString(),

      status: transaction.status,

      providerMerchantRefId: transaction.providerMerchantRefId,

      providerTxnRefId: transaction.providerTxnRefId,

      rrn: transaction.rrn,

      npciCode: transaction.npciCode,

      npciMessage: transaction.npciMessage,

      providerStatusCode: transaction.providerStatusCode,

      providerStatusMessage: transaction.providerStatusMessage,

      bankIIN: transaction.bankIIN,

      aadhaarLast4: transaction.aadhaarLast4,

      createdAt: transaction.createdAt,

      completedAt: transaction.completedAt,
    };
  }

  async listProviderTransactions(dto: ListProviderTransactionsDto) {
    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    const page = Math.max(Number(dto.page) || 1, 1);

    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);

    const skip = (page - 1) * limit;

    const where = {
      userId: dto.userId,

      ...(dto.provider
        ? {
            provider: dto.provider,
          }
        : {}),

      ...(dto.serviceType
        ? {
            serviceType: dto.serviceType,
          }
        : {}),

      ...(dto.operation
        ? {
            operation: dto.operation,
          }
        : {}),

      ...(dto.status
        ? {
            status: dto.status,
          }
        : {}),
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.providerTransaction.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip,

        take: limit,

        select: {
          id: true,

          referenceId: true,

          serviceType: true,

          provider: true,

          operation: true,

          amount: true,

          status: true,

          providerMerchantRefId: true,

          providerTxnRefId: true,

          rrn: true,

          npciCode: true,

          npciMessage: true,

          providerStatusCode: true,

          providerStatusMessage: true,

          bankIIN: true,

          aadhaarLast4: true,

          createdAt: true,

          completedAt: true,
          needsReconciliation: true,
        },
      }),

      this.prisma.providerTransaction.count({
        where,
      }),
    ]);

    return {
      page,

      limit,

      total,

      totalPages: Math.ceil(total / limit),

      data: transactions.map((transaction) => ({
        ...transaction,

        amount: transaction.amount.toString(),
      })),
    };
  }

  async listProviderReconciliationQueue(dto: ListProviderReconciliationDto) {
    const page = Math.max(Number(dto.page) || 1, 1);

    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);

    const where = {
      needsReconciliation: true,

      status: {
        in: dto.status
          ? [dto.status]
          : ['PENDING' as const, 'UNKNOWN' as const],
      },

      ...(dto.provider
        ? {
            provider: dto.provider,
          }
        : {}),

      ...(dto.serviceType
        ? {
            serviceType: dto.serviceType,
          }
        : {}),

      ...(dto.operation
        ? {
            operation: dto.operation,
          }
        : {}),
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.providerTransaction.findMany({
        where,

        orderBy: {
          createdAt: 'asc',
        },

        skip: (page - 1) * limit,

        take: limit,

        select: {
          referenceId: true,

          userId: true,

          serviceType: true,

          provider: true,

          operation: true,

          amount: true,

          status: true,

          providerMerchantRefId: true,

          providerTxnRefId: true,

          rrn: true,

          npciCode: true,

          npciMessage: true,

          providerStatusCode: true,

          providerStatusMessage: true,

          bankIIN: true,

          aadhaarLast4: true,

          needsReconciliation: true,

          reconciliationReason: true,

          providerCalledAt: true,

          createdAt: true,

          updatedAt: true,
        },
      }),

      this.prisma.providerTransaction.count({
        where,
      }),
    ]);

    return {
      page,

      limit,

      total,

      totalPages: Math.ceil(total / limit),

      data: transactions.map((transaction) => ({
        ...transaction,

        amount: transaction.amount.toString(),
      })),
    };
  }

  async resolveProviderTransaction(dto: ResolveProviderTransactionDto) {
    if (!dto.referenceId?.trim()) {
      this.throwRpc(400, 'Transaction reference is required');
    }

    if (!dto.resolvedBy?.trim()) {
      this.throwRpc(400, 'resolvedBy is required');
    }

    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId: dto.referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * Manual reconciliation sirf unresolved
     * transactions par allowed hai.
     */
    if (
      !transaction.needsReconciliation ||
      !['PENDING', 'UNKNOWN'].includes(transaction.status)
    ) {
      this.throwRpc(409, 'Transaction does not require reconciliation');
    }

    /*
     * We are NOT automatically modifying
     * wallet balances here.
     *
     * Ye sirf provider transaction status
     * resolve karta hai.
     */
    return this.prisma.providerTransaction.update({
      where: {
        referenceId: dto.referenceId,
      },

      data: {
        status: dto.resolution,

        needsReconciliation: false,

        reconciliationReason: null,

        reconciliationNote: dto.note?.slice(0, 500),

        reconciledBy: dto.resolvedBy,

        reconciledAt: new Date(),

        providerTxnRefId: dto.providerTxnRefId ?? transaction.providerTxnRefId,

        rrn: dto.rrn ?? transaction.rrn,

        npciCode: dto.npciCode ?? transaction.npciCode,

        npciMessage: dto.npciMessage ?? transaction.npciMessage,

        completedAt: new Date(),
      },
    });
  }

  async requestProviderTransactionReversal(
    dto: RequestProviderTransactionReversalDto,
  ) {
    if (!dto.referenceId?.trim()) {
      this.throwRpc(400, 'Transaction reference is required');
    }

    if (!dto.requestedBy?.trim()) {
      this.throwRpc(400, 'requestedBy is required');
    }

    if (!dto.reason?.trim()) {
      this.throwRpc(400, 'Reversal reason is required');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
    }

    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId: dto.referenceId,
      },

      include: {
        reversal: true,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * Only successful provider transaction
     * reversal request accept karegi.
     */
    if (transaction.status !== 'SUCCESS') {
      this.throwRpc(
        409,
        `Only SUCCESS transactions can be reversed. Current status: ${transaction.status}`,
      );
    }

    /*
     * Already reversal exist karti hai.
     */
    if (transaction.reversal) {
      if (transaction.reversal.idempotencyKey === dto.idempotencyKey) {
        return {
          ...transaction.reversal,

          amount: transaction.reversal.amount.toString(),

          duplicate: true,
        };
      }

      this.throwRpc(409, 'A reversal already exists for this transaction');
    }

    const referenceId = this.generateReference('REV');

    try {
      const reversal = await this.prisma.providerTransactionReversal.create({
        data: {
          referenceId,

          providerTransactionId: transaction.id,

          idempotencyKey: dto.idempotencyKey,

          amount: transaction.amount,

          status: 'REQUESTED',

          reason: dto.reason.trim().slice(0, 500),

          requestedBy: dto.requestedBy,
        },
      });

      /*
       * IMPORTANT:
       *
       * Original ProviderTransaction ko
       * abhi REVERSED nahi karenge.
       */
      return {
        ...reversal,

        amount: reversal.amount.toString(),

        originalTransactionReference: transaction.referenceId,

        originalTransactionStatus: transaction.status,

        nextAction: 'PROCESS_COMPENSATION',

        duplicate: false,
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const reversal =
          await this.prisma.providerTransactionReversal.findFirst({
            where: {
              OR: [
                {
                  providerTransactionId: transaction.id,
                },

                {
                  idempotencyKey: dto.idempotencyKey,
                },
              ],
            },
          });

        if (reversal) {
          return {
            ...reversal,

            amount: reversal.amount.toString(),

            duplicate: true,
          };
        }
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Unable to create transaction reversal',
      });
    }
  }

  async startProviderTransactionReversal(reversalReferenceId: string) {
    if (!reversalReferenceId?.trim()) {
      this.throwRpc(400, 'Reversal reference is required');
    }

    const reversal = await this.prisma.providerTransactionReversal.findUnique({
      where: {
        referenceId: reversalReferenceId,
      },

      include: {
        providerTransaction: true,
      },
    });

    if (!reversal) {
      this.throwRpc(404, 'Provider transaction reversal not found');
    }

    /*
     * Already completed reversal.
     */
    if (reversal.status === 'COMPLETED') {
      return reversal;
    }

    /*
     * Only REQUESTED reversal
     * processing start kar sakti hai.
     */
    if (reversal.status !== 'REQUESTED') {
      this.throwRpc(
        409,
        `Reversal cannot be processed from ${reversal.status} state`,
      );
    }

    /*
     * Original transaction abhi bhi
     * SUCCESS honi chahiye.
     */
    if (reversal.providerTransaction.status !== 'SUCCESS') {
      this.throwRpc(
        409,
        'Original provider transaction is no longer eligible for reversal',
      );
    }

    /*
     * Atomic claim.
     */
    const claimed = await this.prisma.providerTransactionReversal.updateMany({
      where: {
        id: reversal.id,

        status: 'REQUESTED',
      },

      data: {
        status: 'PROCESSING',

        processingAt: new Date(),

        failedReason: null,
      },
    });

    if (claimed.count !== 1) {
      this.throwRpc(409, 'Reversal is already being processed');
    }

    return this.prisma.providerTransactionReversal.findUnique({
      where: {
        id: reversal.id,
      },
    });
  }

  async completeProviderTransactionReversal(
    reversalReferenceId: string,

    compensationReferenceId: string,
  ) {
    if (!compensationReferenceId?.trim()) {
      this.throwRpc(400, 'Compensation transaction reference is required');
    }

    const reversal = await this.prisma.providerTransactionReversal.findUnique({
      where: {
        referenceId: reversalReferenceId,
      },

      include: {
        providerTransaction: true,
      },
    });

    if (!reversal) {
      this.throwRpc(404, 'Provider transaction reversal not found');
    }

    /*
     * Idempotent completion.
     */
    if (reversal.status === 'COMPLETED') {
      if (reversal.compensationReferenceId !== compensationReferenceId) {
        this.throwRpc(
          409,
          'Reversal has already been completed using another compensation transaction',
        );
      }

      return reversal;
    }

    if (reversal.status !== 'PROCESSING') {
      this.throwRpc(
        409,
        `Reversal cannot be completed from ${reversal.status} state`,
      );
    }

    const now = new Date();

    /*
     * Same DB transaction:
     *
     * reversal COMPLETE
     * +
     * original provider transaction REVERSED
     */
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.providerTransactionReversal.update({
        where: {
          id: reversal.id,
        },

        data: {
          status: 'COMPLETED',

          compensationReferenceId,

          completedAt: now,

          failedReason: null,
        },
      });

      await tx.providerTransaction.update({
        where: {
          id: reversal.providerTransactionId,
        },

        data: {
          status: 'REVERSED',

          reversedAt: now,

          needsReconciliation: false,

          reconciliationReason: null,
        },
      });

      return updated;
    });

    return {
      ...result,

      amount: result.amount.toString(),

      originalTransactionReference: reversal.providerTransaction.referenceId,

      originalTransactionStatus: 'REVERSED',
    };
  }

  async failProviderTransactionReversal(
    reversalReferenceId: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      this.throwRpc(400, 'Reversal failure reason is required');
    }

    const reversal = await this.prisma.providerTransactionReversal.findUnique({
      where: {
        referenceId: reversalReferenceId,
      },
    });

    if (!reversal) {
      this.throwRpc(404, 'Provider transaction reversal not found');
    }

    if (reversal.status !== 'PROCESSING') {
      this.throwRpc(409, `Reversal cannot fail from ${reversal.status} state`);
    }

    return this.prisma.providerTransactionReversal.update({
      where: {
        id: reversal.id,
      },

      data: {
        status: 'FAILED',

        failedReason: reason.trim().slice(0, 500),
      },
    });
  }

  async postProviderWalletEntry(dto: PostProviderWalletEntryDto) {
    this.validateWalletType(dto.walletType);

    this.validateAmount(dto.amount);

    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    if (!dto.providerTransactionReference?.trim()) {
      this.throwRpc(400, 'Provider transaction reference is required');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
    }

    if (dto.type !== 'CREDIT' && dto.type !== 'DEBIT') {
      this.throwRpc(400, 'Invalid wallet transaction type');
    }

    if (!['SETTLE', 'RESERVE', 'COMPENSATE'].includes(dto.action)) {
      this.throwRpc(400, 'Invalid provider wallet action');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          /*
           * Prevent concurrent balance
           * modifications on same wallet.
           */
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                ${`${dto.userId}:${dto.walletType}`},
                0
              )
            )
          `;

          /*
           * Canonical provider transaction.
           */
          const providerTransaction = await tx.providerTransaction.findUnique({
            where: {
              referenceId: dto.providerTransactionReference,
            },
          });
          if (!providerTransaction) {
            this.throwRpc(404, 'Provider transaction not found');
          }

          if (providerTransaction.userId !== dto.userId) {
            this.throwRpc(
              409,
              'Provider transaction does not belong to this identity',
            );
          }

          const expectedProviderAmount = dto.providerAmount ?? dto.amount;

          if (Number(providerTransaction.amount) !== expectedProviderAmount) {
            this.throwRpc(
              409,
              'Provider amount does not match canonical provider transaction amount',
            );
          }

          if (dto.action === 'COMPENSATE') {
            if (providerTransaction.status !== 'FAILED') {
              this.throwRpc(
                409,
                `Provider transaction cannot be compensated from ${providerTransaction.status} state`,
              );
            }

            if (providerTransaction.settlementStatus !== 'RESERVED') {
              this.throwRpc(
                409,
                `Provider transaction cannot be compensated from ${providerTransaction.settlementStatus} settlement state`,
              );
            }

            if (dto.type !== 'CREDIT') {
              this.throwRpc(
                400,
                'Provider compensation must be a CREDIT entry',
              );
            }
          }

          /*
           * Same wallet posting already
           * complete ho chuki hai.
           */
          const duplicate = await tx.transaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: dto.userId,

                idempotencyKey: dto.idempotencyKey,
              },
            },
          });

          if (duplicate) {
            /*
             * Same key kisi unrelated
             * transaction ke liye use nahi
             * honi chahiye.
             */
            if (
              duplicate.externalReference !== providerTransaction.referenceId ||
              duplicate.walletType !== dto.walletType ||
              duplicate.type !== dto.type ||
              Number(duplicate.amount) !== dto.amount
            ) {
              this.throwRpc(
                409,
                'Wallet settlement idempotency key has already been used for another transaction',
              );
            }

            return this.serializeTransaction(duplicate);
          }

          /*
           * SETTLE actions provider SUCCESS
           * transaction par hi honi chahiye.
           */
          if (
            dto.action === 'SETTLE' &&
            providerTransaction.status !== 'SUCCESS'
          ) {
            this.throwRpc(
              409,
              `Provider transaction cannot be settled from ${providerTransaction.status} state`,
            );
          }

          /*
           * Last successful wallet balance.
           */
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

          if (dto.type === 'CREDIT') {
            closingBalance = openingBalance + dto.amount;
          } else {
            if (dto.amount > openingBalance) {
              this.throwRpc(
                400,
                `Insufficient ${dto.walletType} wallet balance. Available balance: ₹${openingBalance}`,
              );
            }

            closingBalance = openingBalance - dto.amount;
          }

          const referenceId = this.generateReference('TXN');

          /*
           * Actual wallet ledger entry.
           */
          const walletTransaction = await tx.transaction.create({
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

              externalReference: providerTransaction.referenceId,

              idempotencyKey: dto.idempotencyKey,
            },
          });

          const now = new Date();

          /*
           * Same DB transaction mein
           * ProviderTransaction settlement
           * state update.
           */
          if (dto.action === 'SETTLE') {
            await tx.providerTransaction.update({
              where: {
                id: providerTransaction.id,
              },

              data: {
                settlementStatus: 'SETTLED',

                settlementTransactionReference: walletTransaction.referenceId,

                settlementFailureReason: null,

                settledAt: now,
              },
            });
          }

          if (dto.action === 'RESERVE') {
            await tx.providerTransaction.update({
              where: {
                id: providerTransaction.id,
              },

              data: {
                settlementStatus: 'RESERVED',

                settlementTransactionReference: walletTransaction.referenceId,

                settlementFailureReason: null,

                reservedAt: now,
              },
            });
          }

          if (dto.action === 'COMPENSATE') {
            await tx.providerTransaction.update({
              where: {
                id: providerTransaction.id,
              },

              data: {
                settlementStatus: 'COMPENSATED',

                compensationTransactionReference: walletTransaction.referenceId,

                settlementFailureReason: null,

                compensatedAt: now,
              },
            });
          }

          return this.serializeTransaction(walletTransaction);
        },
        {
          isolationLevel: 'Serializable',
        },
      );
    } catch (error: any) {
      if (error instanceof RpcException) {
        throw error;
      }

      if (error?.code === 'P2034') {
        throw new RpcException({
          statusCode: 409,

          message: 'Wallet settlement conflict. Please retry.',
        });
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Provider wallet settlement failed',
      });
    }
  }

  async prepareProviderWalletDebit(dto: PrepareProviderWalletDebitDto) {
    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Idempotency key is required');
    }

    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      this.throwRpc(400, 'Amount must be greater than 0');
    }

    if (dto.walletType !== 'AEPS') {
      this.throwRpc(400, 'Provider debit currently supports AEPS wallet only');
    }

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          /*
           * Same merchant AEPS wallet par
           * concurrent balance mutations serialize.
           */
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                ${`${dto.userId}:AEPS`},
                0
              )
            )
          `;

          /*
           * Same financial request pehle prepare
           * ho chuki ho to duplicate debit nahi.
           */
          const existingProviderTransaction =
            await tx.providerTransaction.findUnique({
              where: {
                idempotencyKey: dto.idempotencyKey,
              },
            });

          if (existingProviderTransaction) {
            if (
              existingProviderTransaction.userId !== dto.userId ||
              existingProviderTransaction.provider !== dto.provider ||
              existingProviderTransaction.operation !== dto.operation ||
              Number(existingProviderTransaction.amount) !== dto.amount
            ) {
              this.throwRpc(
                409,
                'Provider transaction idempotency key has already been used for another transaction',
              );
            }

            const walletTransaction = await tx.transaction.findFirst({
              where: {
                userId: dto.userId,

                externalReference: existingProviderTransaction.referenceId,

                walletType: 'AEPS',

                type: 'DEBIT',
              },
            });

            if (!walletTransaction) {
              this.throwRpc(
                409,
                'Existing provider transaction does not contain the expected wallet reservation',
              );
            }

            return {
              providerTransaction: existingProviderTransaction,

              walletTransaction,

              duplicate: true,
            };
          }

          /*
           * Current AEPS wallet balance.
           */
          const lastWalletTransaction = await tx.transaction.findFirst({
            where: {
              userId: dto.userId,

              walletType: 'AEPS',

              status: 'SUCCESS',
            },

            orderBy: {
              sequence: 'desc',
            },
          });

          const openingBalance = lastWalletTransaction
            ? Number(lastWalletTransaction.closingBalance)
            : 0;

          /*
           * CD mein provider call se PEHLE
           * enough AEPS wallet hona mandatory.
           */
          if (dto.amount > openingBalance) {
            this.throwRpc(
              400,
              `Insufficient AEPS wallet balance. Available balance: ₹${openingBalance}`,
            );
          }

          const closingBalance = openingBalance - dto.amount;

          /*
           * Canonical PTXN.
           */
          const providerReferenceId = this.generateReference('PTXN');

          const now = new Date();

          const providerTransaction = await tx.providerTransaction.create({
            data: {
              referenceId: providerReferenceId,

              userId: dto.userId,

              serviceType: dto.serviceType,

              provider: dto.provider,

              operation: dto.operation,

              amount: dto.amount,

              status: 'INITIATED',

              idempotencyKey: dto.idempotencyKey,

              merchantProfileId: dto.merchantProfileId,

              providerMerchantId: dto.providerMerchantId,

              bankIIN: dto.bankIIN,

              aadhaarLast4: dto.aadhaarLast4,

              /*
               * Principal debit already reserved.
               */
              settlementStatus: 'RESERVED',

              reservedAt: now,

              metadata: {
                category: 'FINANCIAL',

                settlementMode: 'PRE_DEBIT',
              },
            },
          });

          /*
           * Derived internal wallet key.
           */
          const walletIdempotencyKey = `AEPS:${providerReferenceId}:CD:RESERVE`;

          const walletReferenceId = this.generateReference('TXN');

          const walletTransaction = await tx.transaction.create({
            data: {
              referenceId: walletReferenceId,

              userId: dto.userId,

              walletType: 'AEPS',

              serviceType: dto.walletServiceType,

              type: 'DEBIT',

              amount: dto.amount,

              openingBalance,

              closingBalance,

              status: 'SUCCESS',

              description: dto.walletDescription,

              externalReference: providerReferenceId,

              idempotencyKey: walletIdempotencyKey,
            },
          });

          /*
           * PTXN → wallet reservation linkage.
           */
          const linkedProviderTransaction = await tx.providerTransaction.update(
            {
              where: {
                id: providerTransaction.id,
              },

              data: {
                settlementTransactionReference: walletTransaction.referenceId,
              },
            },
          );

          return {
            providerTransaction: linkedProviderTransaction,

            walletTransaction,

            duplicate: false,
          };
        },
        {
          isolationLevel: 'Serializable',
        },
      );

      return {
        providerTransaction: {
          ...result.providerTransaction,

          amount: result.providerTransaction.amount.toString(),
        },

        walletTransaction: this.serializeTransaction(result.walletTransaction),

        duplicate: result.duplicate,
      };
    } catch (error: any) {
      if (error instanceof RpcException) {
        throw error;
      }

      if (error?.code === 'P2034') {
        throw new RpcException({
          statusCode: 409,

          message: 'AEPS wallet reservation conflict. Please retry.',
        });
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Unable to reserve AEPS wallet balance',
      });
    }
  }

  async confirmProviderWalletReservation(
    dto: ConfirmProviderWalletReservationDto,
  ) {
    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId: dto.providerTransactionReference,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    if (transaction.userId !== dto.userId) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * Idempotent confirmation.
     */
    if (transaction.settlementStatus === 'SETTLED') {
      return transaction;
    }

    if (transaction.status !== 'SUCCESS') {
      this.throwRpc(
        409,
        `Wallet reservation cannot be settled while provider transaction is ${transaction.status}`,
      );
    }

    if (transaction.settlementStatus !== 'RESERVED') {
      this.throwRpc(
        409,
        `Wallet reservation cannot be confirmed from ${transaction.settlementStatus} state`,
      );
    }

    if (!transaction.settlementTransactionReference) {
      this.throwRpc(409, 'Wallet reservation transaction reference is missing');
    }

    return this.prisma.providerTransaction.update({
      where: {
        id: transaction.id,
      },

      data: {
        settlementStatus: 'SETTLED',

        settlementFailureReason: null,

        settledAt: new Date(),
      },
    });
  }

  async updateProviderCommissionState(dto: UpdateProviderCommissionStateDto) {
    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId: dto.referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * Commission sirf successful
     * provider transaction par settle hogi.
     */
    if (dto.status === 'SETTLED' && transaction.status !== 'SUCCESS') {
      this.throwRpc(
        409,
        `Commission cannot be settled while provider transaction is ${transaction.status}`,
      );
    }

    /*
     * Already SETTLED hai.
     * Same data aaye to idempotently return.
     */
    if (transaction.commissionStatus === 'SETTLED') {
      if (
        dto.status === 'SETTLED' &&
        (!dto.commissionReferenceId ||
          transaction.commissionReferenceId === dto.commissionReferenceId)
      ) {
        return transaction;
      }

      this.throwRpc(409, 'Provider transaction commission is already settled');
    }

    const now = new Date();

    return this.prisma.providerTransaction.update({
      where: {
        id: transaction.id,
      },

      data: {
        commissionStatus: dto.status,

        ...(dto.commissionReferenceId !== undefined
          ? {
              commissionReferenceId: dto.commissionReferenceId,
            }
          : {}),

        ...(dto.commissionWalletTransactionReference !== undefined
          ? {
              commissionWalletTransactionReference:
                dto.commissionWalletTransactionReference,
            }
          : {}),

        ...(dto.commissionAmount !== undefined
          ? {
              commissionAmount: dto.commissionAmount,
            }
          : {}),

        commissionFailureReason: dto.failureReason?.slice(0, 500) ?? null,

        commissionSettledAt: dto.status === 'SETTLED' ? now : null,
      },
    });
  }
}
