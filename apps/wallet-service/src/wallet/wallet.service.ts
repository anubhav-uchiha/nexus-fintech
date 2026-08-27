import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';
import { AddMoneyDto } from '@nexus/common/transaction/dto/add-money.dto';
import {
  PeerTransferCommandDto,
  TransferMoneyDto,
  TransferWalletType,
} from '@nexus/common/transaction/dto/transfer-money.dto';
import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';
import { CalculateCommissionDto } from '@nexus/common/commission/dto/calculate-commission.dto';
import { AUTH_PATTERNS } from '@nexus/common';
import { isPeerTransferRole } from '@nexus/common/wallet/peer-transfer.constants';

type PeerTransferParticipants = {
  sender: {
    id: string;
    loginId: string;
    fullName: string;
    role: string;
  };

  receiver: {
    id: string;
    loginId: string;
    fullName: string;
    role: string;
  };
};

@Injectable()
export class WalletService implements OnModuleInit {
  constructor(
    @Inject('TRANSACTION_SERVICE')
    private readonly transactionClient: ClientKafka,
    @Inject('COMMISSION_SERVICE')
    private readonly commissionClient: ClientKafka,
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.transactionClient.subscribeToResponseOf(
      TRANSACTION_PATTERNS.GET_BALANCE,
    );

    this.transactionClient.subscribeToResponseOf(TRANSACTION_PATTERNS.CREATE);

    this.transactionClient.subscribeToResponseOf(TRANSACTION_PATTERNS.TRANSFER);

    this.transactionClient.subscribeToResponseOf(
      TRANSACTION_PATTERNS.CREATE_COMMISSION,
    );

    this.commissionClient.subscribeToResponseOf(COMMISSION_PATTERNS.CALCULATE);

    this.authClient.subscribeToResponseOf(
      AUTH_PATTERNS.RESOLVE_PEER_TRANSFER_PARTICIPANTS,
    );

    await Promise.all([
      this.transactionClient.connect(),
      this.commissionClient.connect(),
      this.authClient.connect(),
    ]);
  }

  async addMoney(dto: AddMoneyDto, role: string) {
    try {
      const commissionCalculation = await firstValueFrom(
        this.commissionClient.send(COMMISSION_PATTERNS.CALCULATE, {
          userId: dto.userId,
          role,
          serviceType: 'ADD_MONEY',
          transactionAmount: dto.amount,
          idempotencyKey: `${dto.idempotencyKey}-COMMISSION`,
        }),
      );
      const commissionAmount = Number(
        commissionCalculation?.commissionAmount ?? 0,
      );
      const netAmount = Number((dto.amount - commissionAmount).toFixed(2));
      if (netAmount <= 0) {
        throw new RpcException({
          status: 400,
          message:
            'Commission cannot be greater than or equal to transaction amount',
        });
      }

      const transaction = await firstValueFrom(
        this.transactionClient.send(TRANSACTION_PATTERNS.CREATE, {
          userId: dto.userId,
          walletType: dto.walletType,
          serviceType: 'ADD_MONEY',
          type: 'CREDIT',
          amount: netAmount,
          description: dto.description ?? 'Wallet Add Money',
          externalReference: dto.externalReference,
          idempotencyKey: dto.idempotencyKey,
        }),
      );
      let commission = null;

      if (commissionAmount > 0) {
        commission = await firstValueFrom(
          this.commissionClient.send(COMMISSION_PATTERNS.CALCULATE, {
            transactionId: transaction.id,
            transactionReference: transaction.referenceId,
            userId: dto.userId,
            role,
            serviceType: 'ADD_MONEY',
            transactionAmount: dto.amount,
            idempotencyKey: `${dto.idempotencyKey}-COMMISSION`,
          }),
        );
      }
      return {
        success: true,
        transaction,
        commission: commission
          ? {
              id: commission.id,
              referenceId: commission.referenceId,
              commissionAmount: Number(commission.commissionAmount),
              commissionType: commission.commissionType,
            }
          : null,
        grossAmount: dto.amount,
        commissionAmount,
        netAmount,
      };
    } catch (error: any) {
      console.error('ADD MONEY ERROR:', error);
      let rpcError = error;
      if (error?.error !== undefined) {
        rpcError = error.error;
      }
      if (typeof rpcError === 'string') {
        try {
          rpcError = JSON.parse(rpcError);
        } catch {
          // keep original string
        }
      }
      const status =
        Number(rpcError?.status) || Number(rpcError?.statusCode) || 500;
      const message = rpcError?.message || error?.message || 'Add money failed';
      throw new RpcException({
        status,
        message,
      });
    }
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
  async transferMoney(dto: PeerTransferCommandDto) {
    try {
      const participants = await firstValueFrom(
        this.authClient.send<PeerTransferParticipants>(
          AUTH_PATTERNS.RESOLVE_PEER_TRANSFER_PARTICIPANTS,
          {
            senderUserId: dto.senderUserId,
            receiverLoginId: dto.receiverLoginId,
          },
        ),
      );
      const senderRole = participants.sender.role;
      const receiverRole = participants.receiver.role;

      if (!isPeerTransferRole(senderRole)) {
        throw new RpcException({
          status: 403,
          message: 'Your role is not allowed to perform peer transfers',
        });
      }

      if (senderRole !== receiverRole) {
        throw new RpcException({
          status: 403,
          message:
            'Wallet transfers are allowed only between users with the same role',
        });
      }

      const transferDto: TransferMoneyDto = {
        senderUserId: participants.sender.id,
        receiverUserId: participants.receiver.id,
        senderLoginId: participants.sender.loginId,
        receiverLoginId: participants.receiver.loginId,
        senderRole,
        receiverRole,
        walletType: TransferWalletType.MAIN,
        amount: dto.amount,
        idempotencyKey: dto.idempotencyKey,
      };

      return await firstValueFrom(
        this.transactionClient.send(TRANSACTION_PATTERNS.TRANSFER, transferDto),
      );
    } catch (error: any) {
      console.error('PEER TRANSFER ERROR:', error);

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

  async calculateCommission(dto: CalculateCommissionDto) {
    try {
      return await firstValueFrom(
        this.commissionClient.send(COMMISSION_PATTERNS.CALCULATE, dto),
      );
    } catch (error: any) {
      console.error('COMMISSION SERVICE ERROR:', error);

      let rpcError = error;
      if (error?.error !== undefined) {
        rpcError = JSON.parse(rpcError);
      }
      if (typeof rpcError == 'string') {
        try {
          rpcError = JSON.parse(rpcError);
        } catch {}
      }
      const status =
        Number(rpcError?.status) || Number(rpcError?.statusCode) || 500;

      const message =
        rpcError?.message || error?.message || 'Commission calculation failed';

      throw new RpcException({
        status,
        message,
      });
    }
  }
}
