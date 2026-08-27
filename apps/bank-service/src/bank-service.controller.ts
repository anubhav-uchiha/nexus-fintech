import { Controller, Get } from '@nestjs/common';
import { BankServiceService } from './bank-service.service';
import { MessagePattern } from '@nestjs/microservices';
import { BANK_PROVIDER_PATTERNS } from '@nexus/common/eko/eko.patterns';

@Controller()
export class BankServiceController {
  constructor(private readonly bankServiceService: BankServiceService) {}

  @MessagePattern(BANK_PROVIDER_PATTERNS.GET_BANK_LIST)
  getBankList() {
    return this.bankServiceService.getBankList();
  }
}
