import { Controller, OnModuleInit } from '@nestjs/common';
import { IdentityBankAccountService } from './identity-bank-account.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BANK_ACCOUNT_PATTERNS } from '@nexus/common/identity-bank-account/identity-bank-account.patterns';
import { CreateIdentityBankAccountDto } from './dto/CreateIdentityBankAccountDto';
import { identity } from 'rxjs';
import {
  IdentityBankAccountDto,
  IdentityDto,
} from 'libs/common/dto/IdentityDto';

import { UpdateBankAccountDto } from '@nexus/common/identity-bank-account/dto/update-bank-account.dto';
import { UpdateBankAccountStatusDto } from '@nexus/common/identity-bank-account/dto/update-bank-account-status.dto';

@Controller()
export class IdentityBankAccountKafkaController {
  constructor(
    private readonly identityBankAccountService: IdentityBankAccountService,
  ) {}

  @MessagePattern(BANK_ACCOUNT_PATTERNS.CREATE_BANK_ACCOUNT)
  createBankAccount(@Payload() dto: CreateIdentityBankAccountDto) {
    console.log('KAFKA received:', dto);
    return this.identityBankAccountService.addBankAccount(dto);
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.GET_MY_BANK_ACCOUNTS)
  getMyBankAccounts(@Payload() dto: string) {
    console.log('KAFKA received:', dto);
    return this.identityBankAccountService.getMyBankAccounts(dto);
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.GET_MY_BANK_ACCOUNT)
  getMyBankAccount(@Payload() dto: IdentityBankAccountDto) {
    console.log('KAFKA received:', dto);
    return this.identityBankAccountService.getMyBankAccount(dto);
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.UPDATE_MY_BANK_ACCOUNT)
  updateMyBankAccount(
    @Payload()
    dto: UpdateBankAccountDto & { identityId: string; bankId: string },
  ) {
    console.log('KAFKA received:', dto);
    return this.identityBankAccountService.updateMyBankAccount(dto);
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.UPDATE_BANK_ACCOUNT_STATUS)
  updateBankAccountStatus(
    @Payload()
    dto: UpdateBankAccountStatusDto & { identityId: string; bankId: string },
  ) {
    console.log('KAFKA received:', dto.status, dto.identityId, dto.bankId);
    return this.identityBankAccountService.updateBankAccountStatus(dto);
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.DELETE_MY_BANK_ACCOUNT)
  deleteMyBankAccount(@Payload() dto: IdentityBankAccountDto) {
    console.log('KAFKA received:', dto);
    return this.identityBankAccountService.deleteMyBankAccount(dto);
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.SET_BANK_ACCOUNT_AS_PRIMARY)
  setBankAccountAsPrimary(@Payload() dto: IdentityBankAccountDto) {
    console.log('KAFKA received:', dto);
    return this.identityBankAccountService.setPrimaryBankAccount(dto);
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.GET_PRIMARY_BANK_ACCOUNT)
  getMyPrimaryBankAccount(@Payload() dto: IdentityDto) {
    console.log('KAFKA received:', dto);
    return this.identityBankAccountService.getPrimaryBankAccount(dto);
  }
}
