import {
  ConflictException,
  Injectable,
  Inject,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import { CreateTransactionDto } from '@nexus/common/transaction/dto/create-transaction.dto';

import {
  TransactionType,
  WalletType,
} from 'apps/transaction-service/generated/prisma/enums';
import { ClientKafka, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';
import { TRANSACTION_COMMISSION_CLIENT } from './transaction.constants';
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
import { CreditCommissionDistributionDto } from '@nexus/common/wallet/dto/credit-commission-distribution.dto';

import {
  AdminListProviderTransactionsDto,
  ListProviderReversalsDto,
} from '@nexus/common/transaction/dto/admin-provider-transactions.dto';

@Injectable()
export class TransactionService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRANSACTION_COMMISSION_CLIENT)
    private readonly commissionClient: ClientKafka,
  ) {}

  async onModuleInit() {
    /*
     * Reversal processor ko commission
     * snapshot/read operations chahiye.
     */

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_PROVIDER_COMMISSION_EXECUTION,
    );

    /*
     * Ye next steps mein add hone wale
     * reversal patterns hain.
     */
    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.MARK_DISTRIBUTION_REVERSED,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.FINALIZE_PROVIDER_COMMISSION_REVERSAL,
    );

    await this.commissionClient.connect();
  }

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

  private async createReversalWalletEntry(input: {
    userId: string;

    providerTransactionReference: string;

    walletType: WalletType;

    serviceType: string;

    type: TransactionType;

    amount: number;

    idempotencyKey: string;

    description: string;

    metadata: Record<string, unknown>;
  }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      this.throwRpc(400, 'Reversal amount must be greater than 0');
    }

    return this.prisma.$transaction(
      async (tx) => {
        /*
         * Same wallet balance mutations serialize.
         */
        await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            ${`${input.userId}:${input.walletType}`},
            0
          )
        )
      `;

        /*
         * Idempotent replay.
         */
        const duplicate = await tx.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.userId,

              idempotencyKey: input.idempotencyKey,
            },
          },
        });

        if (duplicate) {
          if (
            duplicate.externalReference !==
              input.providerTransactionReference ||
            duplicate.walletType !== input.walletType ||
            duplicate.type !== input.type ||
            Number(duplicate.amount) !== input.amount
          ) {
            this.throwRpc(409, 'Reversal wallet idempotency conflict');
          }

          return duplicate;
        }

        const lastTransaction = await tx.transaction.findFirst({
          where: {
            userId: input.userId,

            walletType: input.walletType,

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

        if (input.type === TransactionType.CREDIT) {
          closingBalance = Number((openingBalance + input.amount).toFixed(2));
        } else {
          /*
           * Important:
           *
           * Negative wallet silently allow
           * nahi karenge.
           */
          if (input.amount > openingBalance) {
            this.throwRpc(
              409,
              `Insufficient ${input.walletType} wallet balance for reversal. Required: ₹${input.amount.toFixed(
                2,
              )}, available: ₹${openingBalance.toFixed(2)}`,
            );
          }

          closingBalance = Number((openingBalance - input.amount).toFixed(2));
        }

        return tx.transaction.create({
          data: {
            referenceId: this.generateReference('REV-TXN'),

            userId: input.userId,

            walletType: input.walletType,

            serviceType: input.serviceType,

            type: input.type,

            amount: input.amount,

            openingBalance,

            closingBalance,

            status: 'SUCCESS',

            description: input.description,

            /*
             * Parent remains original PTXN.
             */
            externalReference: input.providerTransactionReference,

            idempotencyKey: input.idempotencyKey,

            metadata: input.metadata as Prisma.InputJsonValue,
          },
        });
      },

      {
        isolationLevel: 'Serializable',
      },
    );
  }

  private async createReconciliationWalletEntry(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;

      providerTransactionReference: string;

      walletType: WalletType;

      serviceType: string;

      type: TransactionType;

      amount: number;

      idempotencyKey: string;

      description: string;

      metadata?: Record<string, unknown>;
    },
  ) {
    /*
     * Wallet mutations on same identity/wallet
     * must remain serialized.
     */
    await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(
        ${`${input.userId}:${input.walletType}`},
        0
      )
    )
  `;

    /*
     * =====================================================
     * IDEMPOTENCY
     * =====================================================
     */

    const duplicate = await tx.transaction.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: input.userId,

          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (duplicate) {
      if (
        duplicate.externalReference !== input.providerTransactionReference ||
        duplicate.walletType !== input.walletType ||
        duplicate.type !== input.type ||
        Number(duplicate.amount) !== input.amount
      ) {
        this.throwRpc(
          409,
          'Reconciliation wallet idempotency key has already been used for another transaction',
        );
      }

      return duplicate;
    }

    /*
     * =====================================================
     * CURRENT WALLET BALANCE
     * =====================================================
     */

    const lastTransaction = await tx.transaction.findFirst({
      where: {
        userId: input.userId,

        walletType: input.walletType,

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

    if (input.type === TransactionType.CREDIT) {
      closingBalance = Number((openingBalance + input.amount).toFixed(2));
    } else {
      if (input.amount > openingBalance) {
        this.throwRpc(
          409,
          `Insufficient ${input.walletType} wallet balance. Available balance: ₹${openingBalance.toFixed(
            2,
          )}`,
        );
      }

      closingBalance = Number((openingBalance - input.amount).toFixed(2));
    }

    /*
     * =====================================================
     * NEW LEDGER ENTRY
     * =====================================================
     */

    return tx.transaction.create({
      data: {
        referenceId: this.generateReference('TXN'),

        userId: input.userId,

        walletType: input.walletType,

        serviceType: input.serviceType,

        type: input.type,

        amount: input.amount,

        openingBalance,

        closingBalance,

        status: 'SUCCESS',

        description: input.description,

        externalReference: input.providerTransactionReference,

        idempotencyKey: input.idempotencyKey,

        ...(input.metadata
          ? {
              metadata: input.metadata as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
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
          sourceRole: dto.sourceRole?.trim() || null,
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
            Number(existing.amount) !== dto.amount ||
            (dto.sourceRole &&
              existing.sourceRole &&
              existing.sourceRole !== dto.sourceRole)
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
    /*
     * =====================================================
     * 1. VALIDATION
     * =====================================================
     */

    if (!referenceId?.trim()) {
      this.throwRpc(400, 'Provider transaction reference is required');
    }

    /*
     * =====================================================
     * 2. FIND CANONICAL PROVIDER TRANSACTION
     * =====================================================
     */

    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * =====================================================
     * 3. OPTIONAL OWNERSHIP CHECK
     * =====================================================
     *
     * Public/user-facing request mein
     * userId provide hoti hai.
     *
     * Internal/admin calls userId omit
     * kar sakti hain.
     */

    if (userId && transaction.userId !== userId) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    /*
     * =====================================================
     * 4. RESPONSE
     * =====================================================
     *
     * IMPORTANT:
     *
     * Reconciliation / provider-income
     * processor ko important financial
     * states TOP LEVEL par bhi chahiye.
     *
     * Nested settlement / commission
     * objects backward compatibility
     * ke liye retain kar rahe hain.
     */

    return {
      /*
       * ===============================================
       * CANONICAL IDENTITY
       * ===============================================
       */

      id: transaction.id,

      referenceId: transaction.referenceId,

      userId: transaction.userId,

      /*
       * Original authenticated role.
       *
       * Delayed provider-income reconciliation
       * ke liye mandatory.
       */
      sourceRole: transaction.sourceRole,

      idempotencyKey: transaction.idempotencyKey,

      /*
       * ===============================================
       * PROVIDER
       * ===============================================
       */

      serviceType: transaction.serviceType,

      provider: transaction.provider,

      operation: transaction.operation,

      amount: transaction.amount.toString(),

      status: transaction.status,

      /*
       * ===============================================
       * PROVIDER REFERENCES
       * ===============================================
       */

      providerMerchantId: transaction.providerMerchantId,

      providerMerchantRefId: transaction.providerMerchantRefId,

      providerTxnRefId: transaction.providerTxnRefId,

      rrn: transaction.rrn,

      npciCode: transaction.npciCode,

      npciMessage: transaction.npciMessage,

      providerStatusCode: transaction.providerStatusCode,

      providerStatusMessage: transaction.providerStatusMessage,

      /*
       * ===============================================
       * SAFE CUSTOMER/BANK DATA
       * ===============================================
       */

      bankIIN: transaction.bankIIN,

      aadhaarLast4: transaction.aadhaarLast4,

      /*
       * ===============================================
       * SETTLEMENT STATE — TOP LEVEL
       * ===============================================
       *
       * Provider-income reconciliation checks:
       *
       * transaction.settlementStatus
       */

      settlementStatus: transaction.settlementStatus,

      settlementTransactionReference:
        transaction.settlementTransactionReference,

      compensationTransactionReference:
        transaction.compensationTransactionReference,

      settlementFailureReason: transaction.settlementFailureReason,

      /*
       * ===============================================
       * COMMISSION STATE — TOP LEVEL
       * ===============================================
       *
       * Provider-income reconciliation checks:
       *
       * WAITING_PROVIDER_INCOME
       * PENDING
       * SETTLED
       */

      commissionStatus: transaction.commissionStatus,

      commissionReferenceId: transaction.commissionReferenceId,

      commissionWalletTransactionReference:
        transaction.commissionWalletTransactionReference,

      commissionAmount:
        transaction.commissionAmount !== null
          ? transaction.commissionAmount.toString()
          : null,

      commissionFailureReason: transaction.commissionFailureReason,

      commissionSettledAt: transaction.commissionSettledAt,

      /*
       * ===============================================
       * PROVIDER INCOME RECONCILIATION AUDIT
       * ===============================================
       */

      providerIncomeSource: transaction.providerIncomeSource,

      providerIncomeExternalReference:
        transaction.providerIncomeExternalReference,

      providerIncomeReconciledAt: transaction.providerIncomeReconciledAt,

      providerIncomeReconciledBy: transaction.providerIncomeReconciledBy,

      /*
       * ===============================================
       * RECONCILIATION — TOP LEVEL
       * ===============================================
       */

      needsReconciliation: transaction.needsReconciliation,

      reconciliationReason: transaction.reconciliationReason,

      reconciledAt: transaction.reconciledAt,

      reconciledBy: transaction.reconciledBy,

      reconciliationNote: transaction.reconciliationNote,

      /*
       * ===============================================
       * REVERSAL
       * ===============================================
       */

      reversedAt: transaction.reversedAt,

      /*
       * ===============================================
       * TIMESTAMPS
       * ===============================================
       */

      providerCalledAt: transaction.providerCalledAt,

      createdAt: transaction.createdAt,

      updatedAt: transaction.updatedAt,

      completedAt: transaction.completedAt,

      /*
       * ===============================================
       * BACKWARD-COMPATIBLE NESTED SETTLEMENT
       * ===============================================
       */

      settlement: {
        status: transaction.settlementStatus,

        transactionReference: transaction.settlementTransactionReference,

        compensationTransactionReference:
          transaction.compensationTransactionReference,

        failureReason: transaction.settlementFailureReason,

        reservedAt: transaction.reservedAt,

        settledAt: transaction.settledAt,

        compensatedAt: transaction.compensatedAt,
      },

      /*
       * ===============================================
       * BACKWARD-COMPATIBLE NESTED COMMISSION
       * ===============================================
       */

      commission: {
        status: transaction.commissionStatus,

        referenceId: transaction.commissionReferenceId,

        walletTransactionReference:
          transaction.commissionWalletTransactionReference,

        amount:
          transaction.commissionAmount !== null
            ? transaction.commissionAmount.toString()
            : null,

        failureReason: transaction.commissionFailureReason,

        settledAt: transaction.commissionSettledAt,

        providerIncomeSource: transaction.providerIncomeSource,

        providerIncomeExternalReference:
          transaction.providerIncomeExternalReference,

        providerIncomeReconciledAt: transaction.providerIncomeReconciledAt,

        providerIncomeReconciledBy: transaction.providerIncomeReconciledBy,
      },

      /*
       * ===============================================
       * BACKWARD-COMPATIBLE RECONCILIATION OBJECT
       * ===============================================
       */

      reconciliation: {
        required: transaction.needsReconciliation,

        reason: transaction.reconciliationReason,

        reconciledAt: transaction.reconciledAt,

        reconciledBy: transaction.reconciledBy,

        note: transaction.reconciliationNote,
      },
    };
  }

  async listProviderTransactions(dto: ListProviderTransactionsDto) {
    if (!dto.userId?.trim()) {
      this.throwRpc(400, 'User ID is required');
    }

    const page = Math.max(Number(dto.page) || 1, 1);

    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);

    const fromDate = this.parseOptionalDate(dto.fromDate, 'fromDate');

    const toDate = this.parseOptionalDate(dto.toDate, 'toDate');

    const where: Prisma.ProviderTransactionWhereInput = {
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

      ...(dto.settlementStatus
        ? {
            settlementStatus: dto.settlementStatus,
          }
        : {}),

      ...(dto.commissionStatus
        ? {
            commissionStatus: dto.commissionStatus,
          }
        : {}),

      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate
                ? {
                    gte: fromDate,
                  }
                : {}),

              ...(toDate
                ? {
                    lte: toDate,
                  }
                : {}),
            },
          }
        : {}),
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.providerTransaction.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip: (page - 1) * limit,

        take: limit,
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
        referenceId: transaction.referenceId,

        provider: transaction.provider,

        operation: transaction.operation,

        amount: transaction.amount.toString(),

        status: transaction.status,

        settlementStatus: transaction.settlementStatus,

        commissionStatus: transaction.commissionStatus,

        providerTxnRefId: transaction.providerTxnRefId,

        merchantRefId: transaction.providerMerchantRefId,

        rrn: transaction.rrn,

        npciCode: transaction.npciCode,

        npciMessage: transaction.npciMessage,

        createdAt: transaction.createdAt,

        completedAt: transaction.completedAt,

        reversedAt: transaction.reversedAt,
      })),
    };
  }

  async listProviderReconciliationQueue(dto: ListProviderReconciliationDto) {
    const page = Math.max(Number(dto.page) || 1, 1);

    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);

    const baseFilters: Prisma.ProviderTransactionWhereInput = {
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

    const providerUnresolved: Prisma.ProviderTransactionWhereInput = {
      needsReconciliation: true,

      status: {
        in: dto.status ? [dto.status] : ['PENDING', 'UNKNOWN'],
      },
    };

    const internalFinancialRecovery: Prisma.ProviderTransactionWhereInput[] =
      dto.status
        ? []
        : [
            /*
             * CW/AP provider succeeded,
             * principal credit missing.
             */
            {
              status: 'SUCCESS',

              operation: {
                in: ['CW', 'AP'],
              },

              settlementStatus: {
                in: ['PENDING', 'UNKNOWN'],
              },
            },

            /*
             * CD provider succeeded but
             * reservation wasn't confirmed.
             */
            {
              status: 'SUCCESS',

              operation: 'CD',

              settlementStatus: 'RESERVED',
            },

            /*
             * CD provider failed but
             * reserved debit wasn't refunded.
             */
            {
              status: 'FAILED',

              operation: 'CD',

              settlementStatus: 'RESERVED',
            },
          ];

    const where: Prisma.ProviderTransactionWhereInput = {
      AND: [
        baseFilters,

        {
          OR: [providerUnresolved, ...internalFinancialRecovery],
        },
      ],
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

          settlementStatus: true,

          settlementTransactionReference: true,

          compensationTransactionReference: true,

          commissionStatus: true,

          commissionAmount: true,
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
    /*
     * =====================================================
     * 1. VALIDATION
     * =====================================================
     */

    if (!dto.referenceId?.trim()) {
      this.throwRpc(400, 'Transaction reference is required');
    }

    if (!dto.resolvedBy?.trim()) {
      this.throwRpc(400, 'resolvedBy is required');
    }

    if (dto.resolution !== 'SUCCESS' && dto.resolution !== 'FAILED') {
      this.throwRpc(400, 'Invalid reconciliation resolution');
    }

    /*
     * =====================================================
     * 2. CLAIM / CREATE RECONCILIATION
     * =====================================================
     */

    let reconciliationId: string;

    try {
      const claim = await this.prisma.$transaction(
        async (tx) => {
          /*
           * Same provider transaction
           * reconciliation serialize.
           */

          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                ${`PTXN:${dto.referenceId}:RECONCILIATION`},
                0
              )
            )
          `;

          const transaction = await tx.providerTransaction.findUnique({
            where: {
              referenceId: dto.referenceId,
            },

            include: {
              reconciliation: true,
            },
          });

          if (!transaction) {
            this.throwRpc(404, 'Provider transaction not found');
          }

          /*
           * Already successfully reconciled.
           */
          if (transaction.reconciliation?.status === 'COMPLETED') {
            if (transaction.reconciliation.resolution !== dto.resolution) {
              this.throwRpc(
                409,
                `Transaction was already reconciled as ${transaction.reconciliation.resolution}`,
              );
            }

            return {
              reconciliation: transaction.reconciliation,

              duplicate: true,
            };
          }

          /*
           * Reconciliation only unresolved
           * PTXN states par.
           */
          if (
            !transaction.needsReconciliation ||
            !['PENDING', 'UNKNOWN'].includes(transaction.status)
          ) {
            this.throwRpc(409, 'Transaction does not require reconciliation');
          }

          /*
           * Previous failed reconciliation
           * same resolution ke saath retryable.
           */
          if (transaction.reconciliation) {
            if (transaction.reconciliation.resolution !== dto.resolution) {
              this.throwRpc(
                409,
                `Existing reconciliation resolution is ${transaction.reconciliation.resolution}`,
              );
            }

            const updated = await tx.providerTransactionReconciliation.update({
              where: {
                id: transaction.reconciliation.id,
              },

              data: {
                status: 'PROCESSING',

                resolvedBy: dto.resolvedBy,

                note: dto.note?.trim().slice(0, 500),

                providerTxnRefId:
                  dto.providerTxnRefId ?? transaction.providerTxnRefId,

                rrn: dto.rrn ?? transaction.rrn,

                npciCode: dto.npciCode ?? transaction.npciCode,

                npciMessage: dto.npciMessage ?? transaction.npciMessage,

                failureReason: null,

                completedAt: null,

                attemptCount: {
                  increment: 1,
                },
              },
            });

            return {
              reconciliation: updated,

              duplicate: false,
            };
          }

          const reconciliation =
            await tx.providerTransactionReconciliation.create({
              data: {
                referenceId: this.generateReference('RECON'),

                providerTransactionId: transaction.id,

                originalStatus: transaction.status,

                resolution: dto.resolution,

                status: 'PROCESSING',

                action: 'NONE',

                resolvedBy: dto.resolvedBy,

                note: dto.note?.trim().slice(0, 500),

                providerTxnRefId:
                  dto.providerTxnRefId ?? transaction.providerTxnRefId,

                rrn: dto.rrn ?? transaction.rrn,

                npciCode: dto.npciCode ?? transaction.npciCode,

                npciMessage: dto.npciMessage ?? transaction.npciMessage,
              },
            });

          return {
            reconciliation,

            duplicate: false,
          };
        },

        {
          isolationLevel: 'Serializable',
        },
      );

      if (claim.duplicate) {
        const transaction = await this.prisma.providerTransaction.findUnique({
          where: {
            referenceId: dto.referenceId,
          },

          include: {
            reconciliation: true,
          },
        });

        return {
          transaction: transaction
            ? {
                ...transaction,

                amount: transaction.amount.toString(),
              }
            : null,

          reconciliation: claim.reconciliation,

          walletTransaction: null,

          duplicate: true,
        };
      }

      reconciliationId = claim.reconciliation.id;
    } catch (error: any) {
      if (error instanceof RpcException) {
        throw error;
      }

      if (error?.code === 'P2034') {
        this.throwRpc(409, 'Reconciliation claim conflict. Please retry.');
      }

      this.throwRpc(
        500,
        error?.message ?? 'Unable to start provider reconciliation',
      );
    }

    /*
     * =====================================================
     * 3. APPLY FINANCIAL EFFECT
     * =====================================================
     */

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                ${`PTXN:${dto.referenceId}:RECONCILIATION`},
                0
              )
            )
          `;

          const transaction = await tx.providerTransaction.findUnique({
            where: {
              referenceId: dto.referenceId,
            },
          });

          if (!transaction) {
            this.throwRpc(404, 'Provider transaction not found');
          }

          const reconciliation =
            await tx.providerTransactionReconciliation.findUnique({
              where: {
                id: reconciliationId,
              },
            });

          if (!reconciliation) {
            this.throwRpc(404, 'Provider reconciliation record not found');
          }

          if (reconciliation.status === 'COMPLETED') {
            return {
              transaction,

              reconciliation,

              walletTransaction: null,

              duplicate: true,
            };
          }

          if (reconciliation.status !== 'PROCESSING') {
            this.throwRpc(
              409,
              `Reconciliation cannot continue from ${reconciliation.status} state`,
            );
          }

          const amount = Number(transaction.amount);

          let action:
            | 'NONE'
            | 'SETTLE_PRINCIPAL'
            | 'CONFIRM_RESERVATION'
            | 'COMPENSATE_RESERVATION' = 'NONE';

          let walletTransaction: any = null;

          const isFinancial = ['CW', 'AP', 'CD'].includes(
            transaction.operation,
          );

          /*
           * =================================================
           * SUCCESS RESOLUTION
           * =================================================
           */

          if (dto.resolution === 'SUCCESS') {
            /*
             * CW / AP
             *
             * Provider actually succeeded.
             * Full principal credit required.
             */
            if (
              transaction.operation === 'CW' ||
              transaction.operation === 'AP'
            ) {
              action = 'SETTLE_PRINCIPAL';

              if (transaction.settlementStatus === 'SETTLED') {
                /*
                 * Already financially settled.
                 * Idempotent.
                 */
              } else if (
                ['PENDING', 'UNKNOWN'].includes(transaction.settlementStatus)
              ) {
                walletTransaction = await this.createReconciliationWalletEntry(
                  tx,
                  {
                    userId: transaction.userId,

                    providerTransactionReference: transaction.referenceId,

                    walletType: WalletType.AEPS,

                    serviceType:
                      transaction.operation === 'CW'
                        ? 'AEPS_CASH_WITHDRAWAL'
                        : 'AEPS_AADHAAR_PAY',

                    type: TransactionType.CREDIT,

                    /*
                     * FULL principal.
                     */
                    amount,

                    idempotencyKey: `RECON:${transaction.referenceId}:PRINCIPAL:SETTLE`,

                    description: `${transaction.operation} principal settlement after provider reconciliation`,

                    metadata: {
                      entryKind: 'PROVIDER_RECONCILIATION_PRINCIPAL',

                      providerTransactionReference: transaction.referenceId,

                      reconciliationResolution: 'SUCCESS',
                    },
                  },
                );

                await tx.providerTransaction.update({
                  where: {
                    id: transaction.id,
                  },

                  data: {
                    settlementStatus: 'SETTLED',

                    settlementTransactionReference:
                      walletTransaction.referenceId,

                    settlementFailureReason: null,

                    settledAt: new Date(),
                  },
                });
              } else {
                this.throwRpc(
                  409,
                  `${transaction.operation} cannot reconcile SUCCESS from ${transaction.settlementStatus} settlement state`,
                );
              }
            }

            /*
             * CD
             *
             * Full debit already RESERVED.
             * Successful provider result means
             * simply confirm it.
             */
            if (transaction.operation === 'CD') {
              action = 'CONFIRM_RESERVATION';

              if (transaction.settlementStatus === 'RESERVED') {
                await tx.providerTransaction.update({
                  where: {
                    id: transaction.id,
                  },

                  data: {
                    settlementStatus: 'SETTLED',

                    settlementFailureReason: null,

                    settledAt: new Date(),
                  },
                });
              } else if (transaction.settlementStatus !== 'SETTLED') {
                this.throwRpc(
                  409,
                  `Cash Deposit cannot reconcile SUCCESS from ${transaction.settlementStatus} settlement state`,
                );
              }
            }
          }

          /*
           * =================================================
           * FAILED RESOLUTION
           * =================================================
           */

          if (dto.resolution === 'FAILED') {
            /*
             * CW / AP:
             * no principal credit.
             */
            if (
              transaction.operation === 'CW' ||
              transaction.operation === 'AP'
            ) {
              /*
               * Agar principal already credited hai,
               * FAILED reconciliation se remove
               * nahi karenge.
               *
               * Proper reversal required.
               */
              if (transaction.settlementStatus === 'SETTLED') {
                this.throwRpc(
                  409,
                  'Principal is already settled. Use transaction reversal instead of FAILED reconciliation.',
                );
              }

              await tx.providerTransaction.update({
                where: {
                  id: transaction.id,
                },

                data: {
                  settlementStatus: 'NOT_REQUIRED',

                  settlementFailureReason: null,
                },
              });
            }

            /*
             * CD:
             *
             * Original AEPS debit exists.
             * Provider actually FAILED.
             * Full refund required.
             */
            if (transaction.operation === 'CD') {
              action = 'COMPENSATE_RESERVATION';

              if (transaction.settlementStatus === 'RESERVED') {
                walletTransaction = await this.createReconciliationWalletEntry(
                  tx,
                  {
                    userId: transaction.userId,

                    providerTransactionReference: transaction.referenceId,

                    walletType: WalletType.AEPS,

                    serviceType: 'AEPS_CASH_DEPOSIT_COMPENSATION',

                    type: TransactionType.CREDIT,

                    amount,

                    idempotencyKey: `RECON:${transaction.referenceId}:CD:COMPENSATE`,

                    description:
                      'Cash Deposit failed after provider reconciliation - full principal compensation',

                    metadata: {
                      entryKind: 'PROVIDER_RECONCILIATION_COMPENSATION',

                      providerTransactionReference: transaction.referenceId,

                      reconciliationResolution: 'FAILED',
                    },
                  },
                );

                await tx.providerTransaction.update({
                  where: {
                    id: transaction.id,
                  },

                  data: {
                    settlementStatus: 'COMPENSATED',

                    compensationTransactionReference:
                      walletTransaction.referenceId,

                    settlementFailureReason: null,

                    compensatedAt: new Date(),
                  },
                });
              } else if (transaction.settlementStatus !== 'COMPENSATED') {
                this.throwRpc(
                  409,
                  `Cash Deposit cannot reconcile FAILED from ${transaction.settlementStatus} settlement state`,
                );
              }
            }
          }

          /*
           * =================================================
           * FINAL PROVIDER TRANSACTION STATE
           * =================================================
           */

          const now = new Date();

          const updatedTransaction = await tx.providerTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              status: dto.resolution,

              needsReconciliation: false,

              reconciliationReason: null,

              reconciliationNote: dto.note?.trim().slice(0, 500),

              reconciledBy: dto.resolvedBy,

              reconciledAt: now,

              providerTxnRefId:
                dto.providerTxnRefId ?? transaction.providerTxnRefId,

              rrn: dto.rrn ?? transaction.rrn,

              npciCode: dto.npciCode ?? transaction.npciCode,

              npciMessage: dto.npciMessage ?? transaction.npciMessage,

              completedAt: now,

              /*
               * Provider transaction SUCCESS:
               *
               * provider income is a separate
               * reconciliation concern.
               */
              ...(isFinancial && dto.resolution === 'SUCCESS'
                ? {
                    commissionStatus: 'WAITING_PROVIDER_INCOME',

                    commissionReferenceId: null,

                    commissionWalletTransactionReference: null,

                    commissionAmount: null,

                    commissionFailureReason:
                      'Waiting for provider income reconciliation',

                    commissionSettledAt: null,
                  }
                : {}),

              /*
               * Definitive FAILED:
               * no provider income.
               */
              ...(isFinancial && dto.resolution === 'FAILED'
                ? {
                    commissionStatus: 'NOT_REQUIRED',

                    commissionReferenceId: null,

                    commissionWalletTransactionReference: null,

                    commissionAmount: null,

                    commissionFailureReason: null,

                    commissionSettledAt: null,
                  }
                : {}),
            },
          });

          /*
           * =================================================
           * RECONCILIATION COMPLETE
           * =================================================
           */

          const completed = await tx.providerTransactionReconciliation.update({
            where: {
              id: reconciliation.id,
            },

            data: {
              status: 'COMPLETED',

              action,

              resolvedBy: dto.resolvedBy,

              note: dto.note?.trim().slice(0, 500),

              providerTxnRefId:
                dto.providerTxnRefId ?? transaction.providerTxnRefId,

              rrn: dto.rrn ?? transaction.rrn,

              npciCode: dto.npciCode ?? transaction.npciCode,

              npciMessage: dto.npciMessage ?? transaction.npciMessage,

              walletTransactionReference:
                walletTransaction?.referenceId ?? null,

              failureReason: null,

              completedAt: now,
            },
          });

          return {
            transaction: updatedTransaction,

            reconciliation: completed,

            walletTransaction,

            duplicate: false,
          };
        },

        {
          isolationLevel: 'Serializable',
        },
      );

      return {
        transaction: {
          ...result.transaction,

          amount: result.transaction.amount.toString(),
        },

        reconciliation: result.reconciliation,

        walletTransaction: result.walletTransaction
          ? this.serializeTransaction(result.walletTransaction)
          : null,

        duplicate: result.duplicate,
      };
    } catch (error: any) {
      /*
       * =====================================================
       * RECONCILIATION FAILED
       * =====================================================
       *
       * Financial DB transaction rollback ho
       * chuki hogi.
       *
       * Audit row ko FAILED mark karenge.
       */

      const message =
        error instanceof RpcException
          ? ((error as any).getError?.()?.message ?? error.message)
          : (error?.message ?? 'Provider reconciliation failed');

      try {
        await this.prisma.providerTransactionReconciliation.update({
          where: {
            id: reconciliationId!,
          },

          data: {
            status: 'FAILED',

            failureReason: String(message).slice(0, 500),

            completedAt: null,
          },
        });
      } catch {
        /*
         * Preserve original error.
         */
      }

      if (error instanceof RpcException) {
        throw error;
      }

      if (error?.code === 'P2034') {
        this.throwRpc(409, 'Reconciliation conflict. Please retry.');
      }

      this.throwRpc(
        500,
        error?.message ?? 'Provider transaction reconciliation failed',
      );
    }
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

    if (!['CW', 'AP', 'CD'].includes(transaction.operation)) {
      this.throwRpc(
        409,
        `Provider operation ${transaction.operation} does not support financial reversal`,
      );
    }

    /*
     * Provider SUCCESS alone enough nahi.
     *
     * Original principal settlement bhi
     * complete honi chahiye.
     */
    if (transaction.settlementStatus !== 'SETTLED') {
      this.throwRpc(
        409,
        `Transaction principal is not settled. Current settlement status: ${transaction.settlementStatus}`,
      );
    }

    /*
     * Already reversal exists.
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

          principalStatus: 'PENDING',

          commissionStatus:
            transaction.commissionReferenceId ||
            transaction.commissionStatus === 'SETTLED' ||
            transaction.commissionStatus === 'PENDING'
              ? 'PENDING'
              : 'NOT_REQUIRED',
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

    if (reversal.status === 'COMPLETED') {
      return reversal;
    }

    const principalComplete =
      reversal.principalStatus === 'COMPLETED' ||
      reversal.principalStatus === 'NOT_REQUIRED';

    const commissionComplete =
      reversal.commissionStatus === 'COMPLETED' ||
      reversal.commissionStatus === 'NOT_REQUIRED';

    if (!principalComplete || !commissionComplete) {
      this.throwRpc(
        409,
        'Reversal cannot be completed until principal and commission compensation are complete',
      );
    }

    /*
     * Never trust arbitrary compensation ref.
     */
    if (
      reversal.principalCompensationReference &&
      compensationReferenceId &&
      reversal.principalCompensationReference !== compensationReferenceId
    ) {
      this.throwRpc(
        409,
        'Compensation reference does not match processed principal reversal',
      );
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.providerTransactionReversal.update({
        where: {
          id: reversal.id,
        },

        data: {
          status: 'COMPLETED',

          compensationReferenceId: reversal.principalCompensationReference,

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

          commissionStatus: 'REVERSED',
        },
      });

      return {
        ...updated,

        amount: updated.amount.toString(),

        originalTransactionReference: reversal.providerTransaction.referenceId,

        originalTransactionStatus: 'REVERSED',
      };
    });
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

              sourceRole: dto.sourceRole?.trim() || null,

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

                incomeModel: 'PROVIDER_INCOME',

                principalAmount: dto.amount.toFixed(2),
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

      include: {
        reversal: true,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    if (transaction.reversal && dto.status !== 'REVERSED') {
      this.throwRpc(
        409,
        'Commission state cannot move forward because a transaction reversal exists',
      );
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

    try {
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

          ...(dto.providerIncomeSource !== undefined
            ? {
                providerIncomeSource: dto.providerIncomeSource,
              }
            : {}),

          ...(dto.providerIncomeExternalReference !== undefined
            ? {
                providerIncomeExternalReference:
                  dto.providerIncomeExternalReference,
              }
            : {}),

          ...(dto.providerIncomeReconciledBy !== undefined
            ? {
                providerIncomeReconciledBy: dto.providerIncomeReconciledBy,

                providerIncomeReconciledAt: new Date(),
              }
            : {}),
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        this.throwRpc(
          409,
          'Provider income external reference has already been reconciled with another transaction',
        );
      }

      throw error;
    }
  }

  async creditProviderCommissionDistribution(
    dto: CreditCommissionDistributionDto,
  ) {
    if (!dto.recipientUserId?.trim()) {
      this.throwRpc(400, 'Commission recipient user ID is required');
    }

    if (!dto.providerTransactionReference?.trim()) {
      this.throwRpc(400, 'Provider transaction reference is required');
    }

    if (!dto.commissionId?.trim()) {
      this.throwRpc(400, 'Commission ID is required');
    }

    if (!dto.commissionReference?.trim()) {
      this.throwRpc(400, 'Commission reference is required');
    }

    if (!dto.distributionTransactionId?.trim()) {
      this.throwRpc(400, 'Commission distribution transaction ID is required');
    }

    if (!dto.idempotencyKey?.trim()) {
      this.throwRpc(400, 'Commission distribution idempotency key is required');
    }

    this.validateAmount(dto.amount);

    /*
     * =====================================================
     * FAST IDEMPOTENCY CHECK
     * =====================================================
     */

    const existing = await this.prisma.transaction.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: dto.recipientUserId,

          idempotencyKey: dto.idempotencyKey,
        },
      },
    });

    if (existing) {
      if (
        existing.walletType !== WalletType.PROFIT ||
        existing.type !== TransactionType.CREDIT ||
        Number(existing.amount) !== dto.amount
      ) {
        this.throwRpc(
          409,
          'Commission distribution idempotency key has already been used for another transaction',
        );
      }

      return this.serializeTransaction(existing);
    }

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          /*
           * =================================================
           * 1. LOCK COMMISSION FUNDING POOL
           * =================================================
           *
           * Same PTXN ke multiple distribution credits
           * total commission pool se zyada nahi ja sakte.
           */

          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                ${`PTXN:${dto.providerTransactionReference}:COMMISSION`},
                0
              )
            )
          `;

          /*
           * Recipient PROFIT wallet lock.
           */

          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                ${`${dto.recipientUserId}:PROFIT`},
                0
              )
            )
          `;

          /*
           * =================================================
           * 2. CANONICAL PROVIDER TRANSACTION
           * =================================================
           */

          const providerTransaction = await tx.providerTransaction.findUnique({
            where: {
              referenceId: dto.providerTransactionReference,
            },

            include: {
              reversal: true,
            },
          });

          if (!providerTransaction) {
            this.throwRpc(404, 'Provider transaction not found');
          }

          if (providerTransaction.reversal) {
            this.throwRpc(
              409,
              `Commission distribution is blocked because reversal ${providerTransaction.reversal.referenceId} exists for this transaction`,
            );
          }
          /*
           * PROFIT distribution only provider
           * SUCCESS hone ke baad.
           */

          if (providerTransaction.status !== 'SUCCESS') {
            this.throwRpc(
              409,
              `Commission cannot be distributed while provider transaction is ${providerTransaction.status}`,
            );
          }

          /*
           * Commission snapshot PTXN se match.
           */

          if (
            providerTransaction.commissionReferenceId &&
            providerTransaction.commissionReferenceId !==
              dto.commissionReference
          ) {
            this.throwRpc(
              409,
              'Commission reference does not match provider transaction',
            );
          }

          const commissionPool = Number(
            providerTransaction.commissionAmount ?? 0,
          );

          if (!Number.isFinite(commissionPool) || commissionPool <= 0) {
            this.throwRpc(
              409,
              'Provider transaction has no commission funding pool',
            );
          }

          /*
           * =================================================
           * 3. IDEMPOTENCY INSIDE LOCK
           * =================================================
           */

          const duplicate = await tx.transaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: dto.recipientUserId,

                idempotencyKey: dto.idempotencyKey,
              },
            },
          });

          if (duplicate) {
            if (
              duplicate.walletType !== WalletType.PROFIT ||
              duplicate.type !== TransactionType.CREDIT ||
              Number(duplicate.amount) !== dto.amount
            ) {
              this.throwRpc(
                409,
                'Commission distribution idempotency key has already been used for another transaction',
              );
            }

            return duplicate;
          }

          /*
           * =================================================
           * 4. HOW MUCH OF THIS PTXN COMMISSION
           *    HAS ALREADY BEEN DISTRIBUTED?
           * =================================================
           *
           * New distribution transactions use
           * externalReference = PTXN reference.
           */

          const alreadyDistributed = await tx.transaction.aggregate({
            where: {
              externalReference: providerTransaction.referenceId,

              walletType: WalletType.PROFIT,

              type: TransactionType.CREDIT,

              status: 'SUCCESS',
            },

            _sum: {
              amount: true,
            },
          });

          const distributedAmount = Number(alreadyDistributed._sum.amount ?? 0);

          const nextTotal = Number((distributedAmount + dto.amount).toFixed(2));

          if (nextTotal > commissionPool) {
            this.throwRpc(
              409,
              `Commission distribution exceeds funding pool. Pool: ₹${commissionPool.toFixed(
                2,
              )}, already distributed: ₹${distributedAmount.toFixed(2)}`,
            );
          }

          /*
           * =================================================
           * 5. RECIPIENT PROFIT BALANCE
           * =================================================
           */

          const lastTransaction = await tx.transaction.findFirst({
            where: {
              userId: dto.recipientUserId,

              walletType: WalletType.PROFIT,

              status: 'SUCCESS',
            },

            orderBy: {
              sequence: 'desc',
            },
          });

          const openingBalance = lastTransaction
            ? Number(lastTransaction.closingBalance)
            : 0;

          const closingBalance = Number(
            (openingBalance + dto.amount).toFixed(2),
          );

          /*
           * =================================================
           * 6. FUNDING SOURCE
           * =================================================
           */

          const fundingSource =
            providerTransaction.provider === 'VIMOPAY'
              ? 'VIMOPAY_PROVIDER_INCOME'
              : 'PROVIDER_COMMISSION';

          /*
           * =================================================
           * 7. PROFIT CREDIT
           * =================================================
           */

          const transaction = await tx.transaction.create({
            data: {
              referenceId: this.generateReference('TXN'),

              userId: dto.recipientUserId,

              walletType: WalletType.PROFIT,

              serviceType: dto.serviceType,

              type: TransactionType.CREDIT,

              amount: dto.amount,

              openingBalance,

              closingBalance,

              status: 'SUCCESS',

              description: `AEPS commission distribution for ${dto.recipientRole}`,

              /*
               * IMPORTANT:
               *
               * Funding parent = PTXN.
               */
              externalReference: providerTransaction.referenceId,

              idempotencyKey: dto.idempotencyKey,

              metadata: {
                entryKind: 'AEPS_COMMISSION_DISTRIBUTION',

                fundingSource,

                providerTransactionReference: providerTransaction.referenceId,

                grossProviderAmount: providerTransaction.amount.toString(),

                commissionPool: commissionPool.toFixed(2),

                commissionId: dto.commissionId,

                commissionReference: dto.commissionReference,

                distributionTransactionId: dto.distributionTransactionId,

                recipientRole: dto.recipientRole,
              },
            },
          });

          return transaction;
        },
        {
          isolationLevel: 'Serializable',
        },
      );

      return this.serializeTransaction(result);
    } catch (error: any) {
      if (error instanceof RpcException) {
        throw error;
      }

      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: dto.recipientUserId,

              idempotencyKey: dto.idempotencyKey,
            },
          },
        });

        if (duplicate) {
          return this.serializeTransaction(duplicate);
        }

        this.throwRpc(409, 'Commission distribution already exists');
      }

      if (error?.code === 'P2034') {
        this.throwRpc(409, 'Commission distribution conflict. Please retry.');
      }

      this.throwRpc(
        500,
        error?.message ?? 'Unable to credit commission distribution',
      );
    }
  }

  async processProviderTransactionReversal(
    reversalReferenceId: string,
    processedBy: string,
  ) {
    if (!reversalReferenceId?.trim()) {
      this.throwRpc(400, 'Reversal reference is required');
    }

    if (!processedBy?.trim()) {
      this.throwRpc(400, 'processedBy is required');
    }

    /*
     * =====================================================
     * 1. CLAIM REVERSAL
     * =====================================================
     */

    let reversal = await this.prisma.providerTransactionReversal.findUnique({
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

    if (reversal.status === 'COMPLETED') {
      return {
        ...reversal,

        amount: reversal.amount.toString(),

        duplicate: true,
      };
    }

    if (reversal.status === 'PROCESSING') {
      this.throwRpc(409, 'Reversal is already being processed');
    }

    if (!['REQUESTED', 'FAILED'].includes(reversal.status)) {
      this.throwRpc(
        409,
        `Reversal cannot be processed from ${reversal.status} state`,
      );
    }

    if (
      reversal.providerTransaction.status !== 'SUCCESS' &&
      reversal.providerTransaction.status !== 'REVERSED'
    ) {
      this.throwRpc(
        409,
        `Original provider transaction cannot be reversed from ${reversal.providerTransaction.status} state`,
      );
    }

    reversal = await this.prisma.providerTransactionReversal.update({
      where: {
        id: reversal.id,
      },

      data: {
        status: 'PROCESSING',

        processingAt: new Date(),

        processedBy,

        failedReason: null,

        /*
         * Completed component retry par
         * dobara execute nahi hogi.
         */
        ...(reversal.principalStatus !== 'COMPLETED'
          ? {
              principalStatus: 'PROCESSING',
            }
          : {}),

        ...(reversal.commissionStatus !== 'COMPLETED' &&
        reversal.commissionStatus !== 'NOT_REQUIRED'
          ? {
              commissionStatus: 'PROCESSING',
            }
          : {}),
      },

      include: {
        providerTransaction: true,
      },
    });

    const providerTransaction = reversal.providerTransaction;

    const amount = Number(providerTransaction.amount);

    /*
     * =====================================================
     * 2. PRINCIPAL REVERSAL
     * =====================================================
     */

    if (reversal.principalStatus !== 'COMPLETED') {
      try {
        let principalType: TransactionType;

        let serviceType: string;

        let description: string;

        /*
         * CW/AP originally CREDIT.
         *
         * Reversal = DEBIT.
         */
        if (
          providerTransaction.operation === 'CW' ||
          providerTransaction.operation === 'AP'
        ) {
          principalType = TransactionType.DEBIT;

          serviceType =
            providerTransaction.operation === 'CW'
              ? 'AEPS_CASH_WITHDRAWAL_REVERSAL'
              : 'AEPS_AADHAAR_PAY_REVERSAL';

          description = `${providerTransaction.operation} provider reversal - principal debit`;
        } else if (providerTransaction.operation === 'CD') {
          /*
           * CD originally DEBIT.
           *
           * Reversal = CREDIT.
           */
          principalType = TransactionType.CREDIT;

          serviceType = 'AEPS_CASH_DEPOSIT_REVERSAL';

          description = 'Cash Deposit provider reversal - principal credit';
        } else {
          this.throwRpc(
            409,
            `Unsupported reversal operation: ${providerTransaction.operation}`,
          );
        }

        const principalTransaction = await this.createReversalWalletEntry({
          userId: providerTransaction.userId,

          providerTransactionReference: providerTransaction.referenceId,

          walletType: WalletType.AEPS,

          type: principalType,

          amount,

          serviceType,

          description,

          idempotencyKey: `REV:${reversal.referenceId}:PRINCIPAL`,

          metadata: {
            entryKind: 'PROVIDER_TRANSACTION_PRINCIPAL_REVERSAL',

            reversalReference: reversal.referenceId,

            providerTransactionReference: providerTransaction.referenceId,

            originalSettlementTransactionReference:
              providerTransaction.settlementTransactionReference,

            operation: providerTransaction.operation,
          },
        });

        /*
         * Record principal reversal.
         */
        await this.prisma.$transaction(async (tx) => {
          await tx.providerTransactionReversal.update({
            where: {
              id: reversal.id,
            },

            data: {
              principalStatus: 'COMPLETED',

              principalCompensationReference: principalTransaction.referenceId,

              principalFailureReason: null,
            },
          });

          /*
           * Original settlement stays in ledger.
           *
           * New compensation reference separately.
           */
          await tx.providerTransaction.update({
            where: {
              id: providerTransaction.id,
            },

            data: {
              settlementStatus: 'COMPENSATED',

              compensationTransactionReference:
                principalTransaction.referenceId,

              settlementFailureReason: null,

              compensatedAt: new Date(),
            },
          });
        });
      } catch (error: any) {
        const message =
          error?.message ??
          error?.error?.message ??
          'Principal reversal failed';

        await this.prisma.providerTransactionReversal.update({
          where: {
            id: reversal.id,
          },

          data: {
            status: 'FAILED',

            principalStatus: 'FAILED',

            principalFailureReason: String(message).slice(0, 500),

            failedReason: String(message).slice(0, 500),
          },
        });

        if (error instanceof RpcException) {
          throw error;
        }

        this.throwRpc(500, message);
      }
    }

    /*
     * =====================================================
     * 3. COMMISSION REVERSAL
     * =====================================================
     */

    try {
      /*
       * No commission record ever created.
       *
       * Example:
       * production transaction still waiting
       * for VimoPay wallet income.
       */
      if (!providerTransaction.commissionReferenceId) {
        await this.prisma.$transaction(async (tx) => {
          await tx.providerTransactionReversal.update({
            where: {
              id: reversal.id,
            },

            data: {
              commissionStatus: 'NOT_REQUIRED',

              commissionFailureReason: null,
            },
          });

          /*
           * Prevent any future provider
           * income distribution.
           */
          await tx.providerTransaction.update({
            where: {
              id: providerTransaction.id,
            },

            data: {
              commissionStatus: 'REVERSED',

              commissionFailureReason: null,

              commissionSettledAt: null,
            },
          });
        });
      } else {
        /*
         * ===============================================
         * READ FROZEN COMMISSION ALLOCATIONS
         * ===============================================
         */

        const execution: any = await firstValueFrom(
          this.commissionClient.send(
            COMMISSION_PATTERNS.GET_PROVIDER_COMMISSION_EXECUTION,

            {
              commissionReference: providerTransaction.commissionReferenceId,
            },
          ),
        );

        const allocations: any[] = Array.isArray(execution?.allocations)
          ? execution.allocations
          : [];

        /*
         * ===============================================
         * REVERSE EVERY ACTUAL SUCCESSFUL CREDIT
         * ===============================================
         */

        for (const allocation of allocations) {
          /*
           * Already reversed.
           */
          if (allocation.status === 'REVERSED') {
            continue;
          }

          /*
           * PENDING/FAILED were never
           * credited to wallet.
           */
          if (allocation.status !== 'SUCCESS') {
            continue;
          }

          const allocationAmount = Number(allocation.amount);

          if (!Number.isFinite(allocationAmount) || allocationAmount <= 0) {
            throw new Error(
              `Invalid commission allocation amount for ${allocation.id}`,
            );
          }

          /*
           * Original PROFIT CREDIT
           * → reversal PROFIT DEBIT.
           */
          const reversalTransaction = await this.createReversalWalletEntry({
            userId: allocation.recipientUserId,

            providerTransactionReference: providerTransaction.referenceId,

            walletType: WalletType.PROFIT,

            type: TransactionType.DEBIT,

            amount: allocationAmount,

            serviceType: `${execution.serviceType}_COMMISSION_REVERSAL`,

            description: `Commission reversal for ${allocation.recipientRole}`,

            idempotencyKey: `REV:${reversal.referenceId}:COMM:${allocation.id}`,

            metadata: {
              entryKind: 'AEPS_COMMISSION_DISTRIBUTION_REVERSAL',

              reversalReference: reversal.referenceId,

              providerTransactionReference: providerTransaction.referenceId,

              commissionReference: providerTransaction.commissionReferenceId,

              distributionTransactionId: allocation.id,

              originalWalletTransactionId: allocation.transactionId,

              originalWalletTransactionReference:
                allocation.transactionReference,

              recipientRole: allocation.recipientRole,
            },
          });

          /*
           * Wallet debit successful.
           *
           * Commission DB allocation now
           * REVERSED.
           */
          await firstValueFrom(
            this.commissionClient.send(
              COMMISSION_PATTERNS.MARK_DISTRIBUTION_REVERSED,

              {
                distributionTransactionId: allocation.id,

                reversalWalletTransactionId: reversalTransaction.id,

                reversalWalletTransactionReference:
                  reversalTransaction.referenceId,
              },
            ),
          );
        }

        /*
         * ===============================================
         * FINALIZE COMMISSION
         * ===============================================
         */

        const finalized: any = await firstValueFrom(
          this.commissionClient.send(
            COMMISSION_PATTERNS.FINALIZE_PROVIDER_COMMISSION_REVERSAL,

            {
              commissionReference: providerTransaction.commissionReferenceId,

              reason: reversal.reason,
            },
          ),
        );

        if (finalized?.status !== 'REVERSED') {
          throw new Error(
            `Commission reversal is incomplete. Remaining allocations: ${finalized?.remainingAllocations ?? 'unknown'}`,
          );
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.providerTransactionReversal.update({
            where: {
              id: reversal.id,
            },

            data: {
              commissionStatus: 'COMPLETED',

              commissionReversalReference:
                providerTransaction.commissionReferenceId,

              commissionFailureReason: null,
            },
          });

          await tx.providerTransaction.update({
            where: {
              id: providerTransaction.id,
            },

            data: {
              commissionStatus: 'REVERSED',

              commissionFailureReason: null,
            },
          });
        });
      }
    } catch (error: any) {
      const message =
        error?.message ?? error?.error?.message ?? 'Commission reversal failed';

      await this.prisma.providerTransactionReversal.update({
        where: {
          id: reversal.id,
        },

        data: {
          status: 'FAILED',

          commissionStatus: 'FAILED',

          commissionFailureReason: String(message).slice(0, 500),

          failedReason: String(message).slice(0, 500),
        },
      });

      if (error instanceof RpcException) {
        throw error;
      }

      this.throwRpc(500, message);
    }

    /*
     * =====================================================
     * 4. FINAL VERIFICATION
     * =====================================================
     */

    const finalReversal =
      await this.prisma.providerTransactionReversal.findUnique({
        where: {
          id: reversal.id,
        },

        include: {
          providerTransaction: true,
        },
      });

    if (!finalReversal) {
      this.throwRpc(404, 'Reversal disappeared during processing');
    }

    const principalComplete =
      finalReversal.principalStatus === 'COMPLETED' ||
      finalReversal.principalStatus === 'NOT_REQUIRED';

    const commissionComplete =
      finalReversal.commissionStatus === 'COMPLETED' ||
      finalReversal.commissionStatus === 'NOT_REQUIRED';

    if (!principalComplete || !commissionComplete) {
      await this.prisma.providerTransactionReversal.update({
        where: {
          id: finalReversal.id,
        },

        data: {
          status: 'FAILED',

          failedReason: 'Reversal components are incomplete',
        },
      });

      this.throwRpc(409, 'Reversal components are incomplete');
    }

    /*
     * =====================================================
     * 5. MARK FINAL REVERSED
     * =====================================================
     */

    const now = new Date();

    const completed = await this.prisma.$transaction(async (tx) => {
      const completedReversal = await tx.providerTransactionReversal.update({
        where: {
          id: finalReversal.id,
        },

        data: {
          status: 'COMPLETED',

          completedAt: now,

          compensationReferenceId: finalReversal.principalCompensationReference,

          failedReason: null,
        },
      });

      await tx.providerTransaction.update({
        where: {
          id: finalReversal.providerTransactionId,
        },

        data: {
          status: 'REVERSED',

          reversedAt: now,

          needsReconciliation: false,

          reconciliationReason: null,

          commissionStatus: 'REVERSED',
        },
      });

      return completedReversal;
    });

    return {
      ...completed,

      amount: completed.amount.toString(),

      originalTransactionReference: providerTransaction.referenceId,

      originalTransactionStatus: 'REVERSED',

      principalStatus: completed.principalStatus,

      commissionStatus: completed.commissionStatus,

      duplicate: false,
    };
  }

  async markProviderFinancialRecoveryRequired(
    referenceId: string,
    reason: string,
  ) {
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
     * Provider result ko change nahi karna.
     *
     * SUCCESS remains SUCCESS.
     * FAILED remains FAILED.
     *
     * Sirf internal financial recovery
     * queue flag set kar rahe hain.
     */
    return this.prisma.providerTransaction.update({
      where: {
        id: transaction.id,
      },

      data: {
        needsReconciliation: true,

        reconciliationReason: (
          reason || 'Internal provider financial effect requires recovery'
        ).slice(0, 500),
      },
    });
  }

  async recoverProviderFinancialEffects(
    referenceId: string,
    recoveredBy: string,
  ) {
    if (!referenceId?.trim()) {
      this.throwRpc(400, 'Provider transaction reference is required');
    }

    if (!recoveredBy?.trim()) {
      this.throwRpc(400, 'recoveredBy is required');
    }

    /*
     * =====================================================
     * 1. READ CANONICAL PTXN
     * =====================================================
     */

    let providerTransaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId,
      },

      include: {
        reversal: true,
      },
    });

    if (!providerTransaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    if (providerTransaction.reversal) {
      this.throwRpc(
        409,
        'Internal financial recovery is blocked because a reversal exists',
      );
    }

    if (!['CW', 'AP', 'CD'].includes(providerTransaction.operation)) {
      this.throwRpc(
        409,
        `Operation ${providerTransaction.operation} does not require financial recovery`,
      );
    }

    if (!['SUCCESS', 'FAILED'].includes(providerTransaction.status)) {
      this.throwRpc(
        409,
        `Provider transaction is still ${providerTransaction.status}. Resolve provider status first.`,
      );
    }

    const principalRecoveryRequired =
      /*
       * CW / AP SUCCESS but principal credit missing.
       */
      (providerTransaction.status === 'SUCCESS' &&
        ['CW', 'AP'].includes(providerTransaction.operation) &&
        ['PENDING', 'UNKNOWN'].includes(
          providerTransaction.settlementStatus,
        )) ||
      /*
       * CD SUCCESS but reserved debit not confirmed.
       */
      (providerTransaction.status === 'SUCCESS' &&
        providerTransaction.operation === 'CD' &&
        providerTransaction.settlementStatus === 'RESERVED') ||
      /*
       * CD FAILED but reserved debit not refunded.
       */
      (providerTransaction.status === 'FAILED' &&
        providerTransaction.operation === 'CD' &&
        providerTransaction.settlementStatus === 'RESERVED') ||
      /*
       * CW/AP FAILED but settlement state
       * still needs normalization.
       */
      (providerTransaction.status === 'FAILED' &&
        ['CW', 'AP'].includes(providerTransaction.operation) &&
        ['PENDING', 'UNKNOWN'].includes(providerTransaction.settlementStatus));

    if (!principalRecoveryRequired) {
      this.throwRpc(
        409,
        `No internal principal recovery is required. Provider status: ${providerTransaction.status}, settlement status: ${providerTransaction.settlementStatus}`,
      );
    }

    const amount = Number(providerTransaction.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      this.throwRpc(409, 'Canonical provider amount is invalid');
    }

    let walletTransaction: any = null;

    /*
     * =====================================================
     * 2. PROVIDER SUCCESS
     * =====================================================
     */

    if (providerTransaction.status === 'SUCCESS') {
      /*
       * ===============================================
       * CW / AP
       * ===============================================
       *
       * Provider succeeded but AEPS principal
       * credit may be missing.
       */
      if (
        providerTransaction.operation === 'CW' ||
        providerTransaction.operation === 'AP'
      ) {
        if (providerTransaction.settlementStatus !== 'SETTLED') {
          if (
            !['PENDING', 'UNKNOWN'].includes(
              providerTransaction.settlementStatus,
            )
          ) {
            this.throwRpc(
              409,
              `${providerTransaction.operation} principal cannot be recovered from ${providerTransaction.settlementStatus} settlement state`,
            );
          }

          /*
           * IMPORTANT:
           *
           * SAME idempotency key normal
           * settlement uses.
           *
           * If original settlement actually
           * committed but response was lost,
           * duplicate wallet credit impossible.
           */

          walletTransaction = await this.postProviderWalletEntry({
            userId: providerTransaction.userId,

            providerTransactionReference: providerTransaction.referenceId,

            walletType: 'AEPS',

            type: 'CREDIT',

            /*
             * FULL principal.
             */
            amount,

            providerAmount: amount,

            serviceType:
              providerTransaction.operation === 'CW'
                ? 'AEPS_CASH_WITHDRAWAL'
                : 'AEPS_AADHAAR_PAY',

            description: `${providerTransaction.operation} AEPS principal settlement recovery`,

            idempotencyKey: `AEPS:${providerTransaction.referenceId}:PRINCIPAL`,

            action: 'SETTLE',
          });
        }
      }

      /*
       * ===============================================
       * CASH DEPOSIT
       * ===============================================
       *
       * Principal debit already happened.
       *
       * SUCCESS means reservation simply becomes
       * SETTLED. No second debit.
       */
      if (providerTransaction.operation === 'CD') {
        if (providerTransaction.settlementStatus === 'RESERVED') {
          await this.confirmProviderWalletReservation({
            userId: providerTransaction.userId,

            providerTransactionReference: providerTransaction.referenceId,
          });
        } else if (providerTransaction.settlementStatus !== 'SETTLED') {
          this.throwRpc(
            409,
            `Cash Deposit SUCCESS cannot be recovered from ${providerTransaction.settlementStatus} settlement state`,
          );
        }
      }
    }

    /*
     * =====================================================
     * 3. PROVIDER FAILED
     * =====================================================
     */

    if (providerTransaction.status === 'FAILED') {
      /*
       * CW/AP provider failed.
       *
       * No principal credit should exist.
       */
      if (
        providerTransaction.operation === 'CW' ||
        providerTransaction.operation === 'AP'
      ) {
        if (providerTransaction.settlementStatus === 'SETTLED') {
          this.throwRpc(
            409,
            'Principal has already been settled. Use reversal instead of FAILED recovery.',
          );
        }

        await this.prisma.providerTransaction.update({
          where: {
            id: providerTransaction.id,
          },

          data: {
            settlementStatus: 'NOT_REQUIRED',

            settlementFailureReason: null,
          },
        });
      }

      /*
       * CD failed:
       *
       * original reservation DEBIT must
       * be refunded completely.
       */
      if (providerTransaction.operation === 'CD') {
        if (providerTransaction.settlementStatus === 'RESERVED') {
          walletTransaction = await this.postProviderWalletEntry({
            userId: providerTransaction.userId,

            providerTransactionReference: providerTransaction.referenceId,

            walletType: 'AEPS',

            type: 'CREDIT',

            amount,

            providerAmount: amount,

            serviceType: 'AEPS_CASH_DEPOSIT_COMPENSATION',

            description:
              'Cash Deposit provider failure - internal recovery compensation',

            /*
             * Same normal compensation key.
             */
            idempotencyKey: `AEPS:${providerTransaction.referenceId}:CD:COMPENSATE`,

            action: 'COMPENSATE',
          });
        } else if (providerTransaction.settlementStatus !== 'COMPENSATED') {
          this.throwRpc(
            409,
            `Cash Deposit FAILED cannot be recovered from ${providerTransaction.settlementStatus} settlement state`,
          );
        }
      }
    }

    /*
     * =====================================================
     * 4. READ FRESH FINANCIAL STATE
     * =====================================================
     */

    providerTransaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId,
      },

      include: {
        reversal: true,
      },
    });

    if (!providerTransaction) {
      this.throwRpc(404, 'Provider transaction disappeared during recovery');
    }

    /*
     * Verify expected final principal state.
     */

    if (providerTransaction.status === 'SUCCESS') {
      if (providerTransaction.settlementStatus !== 'SETTLED') {
        this.throwRpc(
          409,
          `Internal principal recovery is incomplete. Settlement status: ${providerTransaction.settlementStatus}`,
        );
      }
    }

    if (providerTransaction.status === 'FAILED') {
      if (
        providerTransaction.operation === 'CD' &&
        providerTransaction.settlementStatus !== 'COMPENSATED'
      ) {
        this.throwRpc(409, 'Cash Deposit compensation recovery is incomplete');
      }

      if (
        (providerTransaction.operation === 'CW' ||
          providerTransaction.operation === 'AP') &&
        providerTransaction.settlementStatus !== 'NOT_REQUIRED'
      ) {
        this.throwRpc(409, 'Failed transaction settlement state is incomplete');
      }
    }

    /*
     * =====================================================
     * 5. COMMISSION NEXT STATE
     * =====================================================
     *
     * SUCCESS:
     * principal recovered.
     *
     * Actual/dummy provider income is a
     * separate step.
     */

    const commissionUpdate: any = {};

    if (
      providerTransaction.status === 'SUCCESS' &&
      providerTransaction.commissionStatus !== 'SETTLED' &&
      providerTransaction.commissionStatus !== 'REVERSED' &&
      !providerTransaction.commissionReferenceId
    ) {
      commissionUpdate.commissionStatus = 'WAITING_PROVIDER_INCOME';

      commissionUpdate.commissionFailureReason =
        'Principal recovered; waiting for provider income reconciliation';

      commissionUpdate.commissionAmount = null;

      commissionUpdate.commissionSettledAt = null;
    }

    /*
     * Definitive failure:
     * no provider income.
     */
    if (providerTransaction.status === 'FAILED') {
      commissionUpdate.commissionStatus = 'NOT_REQUIRED';

      commissionUpdate.commissionReferenceId = null;

      commissionUpdate.commissionWalletTransactionReference = null;

      commissionUpdate.commissionAmount = null;

      commissionUpdate.commissionFailureReason = null;

      commissionUpdate.commissionSettledAt = null;
    }

    /*
     * =====================================================
     * 6. CLEAR RECOVERY FLAG
     * =====================================================
     */

    const recovered = await this.prisma.providerTransaction.update({
      where: {
        id: providerTransaction.id,
      },

      data: {
        needsReconciliation: false,

        reconciliationReason: null,

        reconciledBy: recoveredBy,

        reconciledAt: new Date(),

        reconciliationNote: 'Internal provider financial effects recovered',

        ...commissionUpdate,
      },
    });

    return {
      transaction: {
        referenceId: recovered.referenceId,

        status: recovered.status,

        operation: recovered.operation,

        amount: recovered.amount.toString(),
      },

      settlement: {
        status: recovered.settlementStatus,

        transactionReference: recovered.settlementTransactionReference,

        compensationTransactionReference:
          recovered.compensationTransactionReference,
      },

      commission: {
        status: recovered.commissionStatus,

        amount: recovered.commissionAmount
          ? recovered.commissionAmount.toString()
          : null,

        referenceId: recovered.commissionReferenceId,
      },

      walletTransaction: walletTransaction
        ? this.serializeTransaction(walletTransaction)
        : null,
    };
  }

  private parseOptionalDate(
    value: string | undefined,
    label: string,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      this.throwRpc(400, `${label} must be a valid date`);
    }

    return date;
  }

  async adminListProviderTransactions(dto: AdminListProviderTransactionsDto) {
    const page = Math.max(Number(dto.page) || 1, 1);

    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);

    const fromDate = this.parseOptionalDate(dto.fromDate, 'fromDate');

    const toDate = this.parseOptionalDate(dto.toDate, 'toDate');

    const where: Prisma.ProviderTransactionWhereInput = {
      ...(dto.userId
        ? {
            userId: dto.userId,
          }
        : {}),

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

      ...(dto.settlementStatus
        ? {
            settlementStatus: dto.settlementStatus,
          }
        : {}),

      ...(dto.commissionStatus
        ? {
            commissionStatus: dto.commissionStatus,
          }
        : {}),

      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate
                ? {
                    gte: fromDate,
                  }
                : {}),

              ...(toDate
                ? {
                    lte: toDate,
                  }
                : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.providerTransaction.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip: (page - 1) * limit,

        take: limit,
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

      data: data.map((transaction) => ({
        id: transaction.id,

        referenceId: transaction.referenceId,

        userId: transaction.userId,

        sourceRole: transaction.sourceRole,

        provider: transaction.provider,

        serviceType: transaction.serviceType,

        operation: transaction.operation,

        amount: transaction.amount.toString(),

        status: transaction.status,

        settlementStatus: transaction.settlementStatus,

        commissionStatus: transaction.commissionStatus,

        commissionAmount:
          transaction.commissionAmount !== null
            ? transaction.commissionAmount.toString()
            : null,

        providerIncomeSource: transaction.providerIncomeSource,

        providerTxnRefId: transaction.providerTxnRefId,

        merchantRefId: transaction.providerMerchantRefId,

        rrn: transaction.rrn,

        needsReconciliation: transaction.needsReconciliation,

        createdAt: transaction.createdAt,

        completedAt: transaction.completedAt,

        reversedAt: transaction.reversedAt,
      })),
    };
  }

  async listPendingProviderIncome(dto: AdminListProviderTransactionsDto) {
    return this.adminListProviderTransactions({
      ...dto,

      status: 'SUCCESS',

      settlementStatus: 'SETTLED',

      commissionStatus: 'WAITING_PROVIDER_INCOME',
    });
  }

  async listProviderReversals(dto: ListProviderReversalsDto) {
    const page = Math.max(Number(dto.page) || 1, 1);

    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);

    const where: Prisma.ProviderTransactionReversalWhereInput = {
      ...(dto.status
        ? {
            status: dto.status,
          }
        : {}),

      ...(dto.userId || dto.provider || dto.operation
        ? {
            providerTransaction: {
              ...(dto.userId
                ? {
                    userId: dto.userId,
                  }
                : {}),

              ...(dto.provider
                ? {
                    provider: dto.provider,
                  }
                : {}),

              ...(dto.operation
                ? {
                    operation: dto.operation,
                  }
                : {}),
            },
          }
        : {}),
    };

    const [reversals, total] = await this.prisma.$transaction([
      this.prisma.providerTransactionReversal.findMany({
        where,

        include: {
          providerTransaction: true,
        },

        orderBy: {
          createdAt: 'desc',
        },

        skip: (page - 1) * limit,

        take: limit,
      }),

      this.prisma.providerTransactionReversal.count({
        where,
      }),
    ]);

    return {
      page,
      limit,
      total,

      totalPages: Math.ceil(total / limit),

      data: reversals.map((item) => ({
        referenceId: item.referenceId,

        providerTransactionReference: item.providerTransaction.referenceId,

        provider: item.providerTransaction.provider,

        operation: item.providerTransaction.operation,

        userId: item.providerTransaction.userId,

        amount: item.amount.toString(),

        status: item.status,

        principalStatus: item.principalStatus,

        commissionStatus: item.commissionStatus,

        reason: item.reason,

        requestedBy: item.requestedBy,

        processedBy: item.processedBy,

        failedReason: item.failedReason,

        createdAt: item.createdAt,

        completedAt: item.completedAt,
      })),
    };
  }

  async getProviderReversal(referenceId: string) {
    if (!referenceId?.trim()) {
      this.throwRpc(400, 'Reversal reference is required');
    }

    const reversal = await this.prisma.providerTransactionReversal.findUnique({
      where: {
        referenceId,
      },

      include: {
        providerTransaction: true,
      },
    });

    if (!reversal) {
      this.throwRpc(404, 'Provider transaction reversal not found');
    }

    return {
      ...reversal,

      amount: reversal.amount.toString(),

      providerTransaction: {
        ...reversal.providerTransaction,

        amount: reversal.providerTransaction.amount.toString(),

        commissionAmount:
          reversal.providerTransaction.commissionAmount !== null
            ? reversal.providerTransaction.commissionAmount.toString()
            : null,
      },
    };
  }

  async getProviderReceipt(referenceId: string, userId?: string) {
    const transaction = await this.prisma.providerTransaction.findUnique({
      where: {
        referenceId,
      },
    });

    if (!transaction) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    if (userId && transaction.userId !== userId) {
      this.throwRpc(404, 'Provider transaction not found');
    }

    const metadata =
      transaction.metadata &&
      typeof transaction.metadata === 'object' &&
      !Array.isArray(transaction.metadata)
        ? (transaction.metadata as Record<string, unknown>)
        : {};

    const operationLabels: Record<string, string> = {
      BE: 'Balance Enquiry',

      MS: 'Mini Statement',

      CW: 'Cash Withdrawal',

      AP: 'Aadhaar Pay',

      CD: 'Cash Deposit',
    };

    return {
      provider: transaction.provider,

      transactionType: transaction.operation,

      transactionTypeLabel:
        operationLabels[transaction.operation] ?? transaction.operation,

      status: transaction.status,

      statusDescription: transaction.providerStatusMessage,

      transactionReferenceId: transaction.referenceId,

      /*
       * Provider receipt references.
       */
      ackNo: transaction.providerTxnRefId,

      rrn: transaction.rrn,

      clientRefNo: transaction.providerMerchantRefId,

      amount: transaction.amount.toString(),

      transactionDateTime:
        typeof metadata.providerTxnDateTime === 'string'
          ? metadata.providerTxnDateTime
          : (transaction.completedAt ??
            transaction.providerCalledAt ??
            transaction.createdAt),

      bankIIN: transaction.bankIIN,

      maskedAadhaar: transaction.aadhaarLast4
        ? `XXXXXXXX${transaction.aadhaarLast4}`
        : null,

      npciCode: transaction.npciCode,

      npciMessage: transaction.npciMessage,

      availableBalance:
        typeof metadata.availableBalance === 'string'
          ? metadata.availableBalance
          : null,

      reversed: transaction.status === 'REVERSED',

      reversedAt: transaction.reversedAt,
    };
  }
}
