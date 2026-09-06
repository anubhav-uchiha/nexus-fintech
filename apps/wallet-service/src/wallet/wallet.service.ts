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
import { SettleAepsPrincipalDto } from '@nexus/common/wallet/dto/settle-aeps-principal.dto';
import {
  CompensateAepsCashDepositDto,
  ConfirmAepsCashDepositDto,
  PrepareAepsCashDepositDto,
} from '@nexus/common/wallet/dto/aeps-cash-deposit-settlement.dto';
import { CreditAepsCommissionDto } from '@nexus/common/wallet/dto/credit-aeps-commission.dto';
import { CreditCommissionDistributionDto } from '@nexus/common/wallet/dto/credit-commission-distribution.dto';

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

    this.transactionClient.subscribeToResponseOf(
      TRANSACTION_PATTERNS.POST_PROVIDER_WALLET_ENTRY,
    );

    this.commissionClient.subscribeToResponseOf(COMMISSION_PATTERNS.CALCULATE);

    this.authClient.subscribeToResponseOf(
      AUTH_PATTERNS.RESOLVE_PEER_TRANSFER_PARTICIPANTS,
    );

    this.transactionClient.subscribeToResponseOf(
      TRANSACTION_PATTERNS.PREPARE_PROVIDER_WALLET_DEBIT,
    );

    this.transactionClient.subscribeToResponseOf(
      TRANSACTION_PATTERNS.CONFIRM_PROVIDER_WALLET_RESERVATION,
    );

    this.transactionClient.subscribeToResponseOf(
      TRANSACTION_PATTERNS.CREDIT_PROVIDER_COMMISSION_DISTRIBUTION,
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
          statusCode: 400,
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
        statusCode: status,
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
          statusCode: 403,
          message: 'Your role is not allowed to perform peer transfers',
        });
      }

      if (senderRole !== receiverRole) {
        throw new RpcException({
          statusCode: 403,
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
        statusCode: status,
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
        statusCode: status,
        message,
      });
    }
  }

  async settleAepsPrincipal(dto: SettleAepsPrincipalDto) {
    /*
     * =====================================================
     * 1. VALIDATION
     * =====================================================
     */

    if (!dto.userId?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'User ID is required',
      });
    }

    if (!dto.providerTransactionReference?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Provider transaction reference is required',
      });
    }

    if (!Number.isFinite(dto.grossAmount) || dto.grossAmount <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Gross settlement amount must be greater than 0',
      });
    }

    if (!Number.isFinite(dto.netAmount) || dto.netAmount <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Net settlement amount must be greater than 0',
      });
    }

    if (dto.netAmount > dto.grossAmount) {
      throw new RpcException({
        statusCode: 409,
        message: 'Net principal cannot exceed gross transaction amount',
      });
    }

    /*
     * =====================================================
     * 2. OPERATION → SERVICE TYPE
     * =====================================================
     *
     * CW SUCCESS → AEPS CREDIT
     * AP SUCCESS → AEPS CREDIT
     *
     * Wallet amount will be NET principal.
     */

    let serviceType: string;

    switch (dto.operation) {
      case 'CW':
        serviceType = 'AEPS_CASH_WITHDRAWAL';
        break;

      case 'AP':
        serviceType = 'AEPS_AADHAAR_PAY';
        break;

      default:
        throw new RpcException({
          statusCode: 400,
          message: `Unsupported AEPS settlement operation: ${dto.operation}`,
        });
    }

    /*
     * =====================================================
     * 3. ACCOUNTING SAFETY
     * =====================================================
     *
     * Example:
     *
     * Gross      = ₹150
     * Commission = ₹10
     * Net        = ₹140
     *
     * This method only settles ₹140
     * into AEPS wallet.
     */

    const grossPaise = Math.round(dto.grossAmount * 100);

    const netPaise = Math.round(dto.netAmount * 100);

    if (netPaise > grossPaise) {
      throw new RpcException({
        statusCode: 409,
        message: 'Net principal cannot exceed gross transaction amount',
      });
    }

    /*
     * =====================================================
     * 4. DERIVED IDEMPOTENCY KEY
     * =====================================================
     *
     * Frontend does not control this.
     */

    const idempotencyKey = `AEPS:${dto.providerTransactionReference}:PRINCIPAL`;

    /*
     * =====================================================
     * 5. SETTLE NET PRINCIPAL
     * =====================================================
     *
     * providerAmount:
     * Canonical ProviderTransaction gross amount.
     *
     * amount:
     * Actual AEPS wallet movement.
     */

    return firstValueFrom(
      this.transactionClient.send(
        TRANSACTION_PATTERNS.POST_PROVIDER_WALLET_ENTRY,

        {
          userId: dto.userId,

          providerTransactionReference: dto.providerTransactionReference,

          walletType: 'AEPS',

          type: 'CREDIT',

          /*
           * AEPS wallet receives NET.
           */
          amount: dto.netAmount,

          /*
           * ProviderTransaction remains GROSS.
           */
          providerAmount: dto.grossAmount,

          serviceType,

          description: `${dto.operation} AEPS net principal settlement`,

          idempotencyKey,

          action: 'SETTLE',
        },
      ),
    );
  }

  async prepareAepsCashDeposit(dto: PrepareAepsCashDepositDto) {
    return firstValueFrom(
      this.transactionClient.send(
        TRANSACTION_PATTERNS.PREPARE_PROVIDER_WALLET_DEBIT,

        {
          userId: dto.userId,

          provider: 'VIMOPAY',

          serviceType: 'AEPS',

          operation: 'CD',

          sourceRole: dto.sourceRole,

          amount: dto.amount,

          idempotencyKey: dto.providerTransactionIdempotencyKey,

          merchantProfileId: dto.merchantProfileId,

          providerMerchantId: dto.providerMerchantId,

          bankIIN: dto.bankIIN,

          aadhaarLast4: dto.aadhaarLast4,

          walletType: 'AEPS',

          walletServiceType: 'AEPS_CASH_DEPOSIT',

          walletDescription: 'AEPS Cash Deposit gross funding reservation',
        },
      ),
    );
  }

  async confirmAepsCashDeposit(dto: ConfirmAepsCashDepositDto) {
    return firstValueFrom(
      this.transactionClient.send(
        TRANSACTION_PATTERNS.CONFIRM_PROVIDER_WALLET_RESERVATION,

        {
          userId: dto.userId,

          providerTransactionReference: dto.providerTransactionReference,
        },
      ),
    );
  }

  async compensateAepsCashDeposit(dto: CompensateAepsCashDepositDto) {
    const idempotencyKey = `AEPS:${dto.providerTransactionReference}:CD:COMPENSATE`;

    return firstValueFrom(
      this.transactionClient.send(
        TRANSACTION_PATTERNS.POST_PROVIDER_WALLET_ENTRY,

        {
          userId: dto.userId,

          providerTransactionReference: dto.providerTransactionReference,

          walletType: 'AEPS',

          /*
           * Original was DEBIT.
           * Compensation is CREDIT.
           */
          type: 'CREDIT',

          amount: dto.amount,

          serviceType: 'AEPS_CASH_DEPOSIT_COMPENSATION',

          description: 'AEPS Cash Deposit failed - principal compensation',

          idempotencyKey,

          action: 'COMPENSATE',
        },
      ),
    );
  }

  async creditAepsCommission(dto: CreditAepsCommissionDto) {
    if (!dto.userId?.trim()) {
      throw new RpcException({
        statusCode: 400,

        message: 'User ID is required',
      });
    }

    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new RpcException({
        statusCode: 400,

        message: 'Commission amount must be greater than 0',
      });
    }

    /*
     * Derived idempotency key.
     */
    const idempotencyKey = `PROFIT:${dto.commissionReference}:CREDIT`;

    /*
     * Existing Transaction.create
     * already:
     *
     * - wallet advisory lock
     * - idempotency
     * - opening/closing balance
     *
     * handle karta hai.
     */
    return firstValueFrom(
      this.transactionClient.send(
        TRANSACTION_PATTERNS.CREATE,

        {
          userId: dto.userId,

          walletType: 'PROFIT',

          serviceType: dto.serviceType,

          type: 'CREDIT',

          amount: dto.amount,

          description: 'AEPS commission credit',

          externalReference: dto.commissionReference,

          idempotencyKey,
        },
      ),
    );
  }

  async creditCommissionDistribution(dto: CreditCommissionDistributionDto) {
    if (!dto.recipientUserId?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Commission recipient user ID is required',
      });
    }

    if (!dto.providerTransactionReference?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Provider transaction reference is required',
      });
    }

    if (!dto.distributionTransactionId?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Distribution transaction ID is required',
      });
    }

    if (!dto.commissionReference?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Commission reference is required',
      });
    }

    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Commission distribution amount must be greater than 0',
      });
    }

    if (!dto.idempotencyKey?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Commission distribution idempotency key is required',
      });
    }

    return firstValueFrom(
      this.transactionClient.send(
        TRANSACTION_PATTERNS.CREDIT_PROVIDER_COMMISSION_DISTRIBUTION,
        dto,
      ),
    );
  }
}
