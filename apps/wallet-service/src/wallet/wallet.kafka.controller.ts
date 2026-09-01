import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WalletService } from './wallet.service';
import { WALLET_PATTERNS } from '@nexus/common/wallet/wallet.patterns';
import { AddMoneyDto } from '@nexus/common/transaction/dto/add-money.dto';
import {
  PeerTransferCommandDto,
  TransferMoneyDto,
} from '@nexus/common/transaction/dto/transfer-money.dto';
import { CalculateCommissionDto } from '@nexus/common/commission/dto/calculate-commission.dto';
import { SettleAepsPrincipalDto } from '@nexus/common/wallet/dto/settle-aeps-principal.dto';
import {
  CompensateAepsCashDepositDto,
  ConfirmAepsCashDepositDto,
  PrepareAepsCashDepositDto,
} from '@nexus/common/wallet/dto/aeps-cash-deposit-settlement.dto';
import { CreditAepsCommissionDto } from '@nexus/common/wallet/dto/credit-aeps-commission.dto';
import { CreditCommissionDistributionDto } from '@nexus/common/wallet/dto/credit-commission-distribution.dto';

@Controller()
export class WalletKafkaController {
  constructor(private readonly walletService: WalletService) {}

  @MessagePattern(WALLET_PATTERNS.ADD_MONEY)
  async addMoney(@Payload() data: { dto: AddMoneyDto; role: string }) {
    return this.walletService.addMoney(data.dto, data.role);
  }

  @MessagePattern(WALLET_PATTERNS.GET_BALANCES)
  async getBalances(
    @Payload()
    payload: {
      userId: string;
    },
  ) {
    return this.walletService.getBalances(payload.userId);
  }

  @MessagePattern(WALLET_PATTERNS.TRANSFER)
  async transferMoney(@Payload() dto: PeerTransferCommandDto) {
    return this.walletService.transferMoney(dto);
  }

  @MessagePattern(WALLET_PATTERNS.CALCULATE_COMMISSION)
  async calculateCommission(@Payload() dto: CalculateCommissionDto) {
    return this.walletService.calculateCommission(dto);
  }

  @MessagePattern(WALLET_PATTERNS.SETTLE_AEPS_PRINCIPAL)
  settleAepsPrincipal(
    @Payload()
    dto: SettleAepsPrincipalDto,
  ) {
    return this.walletService.settleAepsPrincipal(dto);
  }

  @MessagePattern(WALLET_PATTERNS.PREPARE_AEPS_CASH_DEPOSIT)
  prepareAepsCashDeposit(
    @Payload()
    dto: PrepareAepsCashDepositDto,
  ) {
    return this.walletService.prepareAepsCashDeposit(dto);
  }

  @MessagePattern(WALLET_PATTERNS.CONFIRM_AEPS_CASH_DEPOSIT)
  confirmAepsCashDeposit(
    @Payload()
    dto: ConfirmAepsCashDepositDto,
  ) {
    return this.walletService.confirmAepsCashDeposit(dto);
  }

  @MessagePattern(WALLET_PATTERNS.COMPENSATE_AEPS_CASH_DEPOSIT)
  compensateAepsCashDeposit(
    @Payload()
    dto: CompensateAepsCashDepositDto,
  ) {
    return this.walletService.compensateAepsCashDeposit(dto);
  }

  @MessagePattern(WALLET_PATTERNS.CREDIT_AEPS_COMMISSION)
  creditAepsCommission(
    @Payload()
    dto: CreditAepsCommissionDto,
  ) {
    return this.walletService.creditAepsCommission(dto);
  }

  @MessagePattern(WALLET_PATTERNS.CREDIT_COMMISSION_DISTRIBUTION)
  creditCommissionDistribution(
    @Payload()
    dto: CreditCommissionDistributionDto,
  ) {
    return this.walletService.creditCommissionDistribution(dto);
  }
}
