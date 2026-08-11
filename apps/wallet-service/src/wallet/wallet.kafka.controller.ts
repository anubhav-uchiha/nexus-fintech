import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WalletService } from './wallet.service';
import { WALLET_PATTERNS } from '@nexus/common/wallet/wallet.patterns';
import { AddMoneyDto } from '@nexus/common/transaction/dto/add-money.dto';
import { TransferMoneyDto } from '@nexus/common/transaction/dto/transfer-money.dto';

@Controller()
export class WalletKafkaController {
  constructor(private readonly walletService: WalletService) {}

  @MessagePattern(WALLET_PATTERNS.ADD_MONEY)
  async addMoney(@Payload() dto: AddMoneyDto) {
    return this.walletService.addMoney(dto);
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
  async transferMoney(@Payload() dto: TransferMoneyDto) {
    return this.walletService.transferMoney(dto);
  }
}
