import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { CreateBankAccountDto } from '@nexus/common/identity-bank-account/dto/create-bank-account.dto';
import { UpdateBankAccountStatusDto } from '@nexus/common/identity-bank-account/dto/update-bank-account-status.dto';
import { UpdateBankAccountDto } from '@nexus/common/identity-bank-account/dto/update-bank-account.dto';
import { BANK_ACCOUNT_PATTERNS } from '@nexus/common/identity-bank-account/identity-bank-account.patterns';
import {
  IdentityBankAccountDto,
  IdentityDto,
} from 'libs/common/dto/IdentityDto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class IdentityBankAccountService implements OnModuleInit {
  constructor(
    @Inject('IDENTITY_BANK_ACCOUNT_SERVICE')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.CREATE_BANK_ACCOUNT,
    );
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.GET_MY_BANK_ACCOUNTS,
    );
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.GET_MY_BANK_ACCOUNT,
    );
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.UPDATE_MY_BANK_ACCOUNT,
    );
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.UPDATE_BANK_ACCOUNT_STATUS,
    );
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.SET_BANK_ACCOUNT_AS_PRIMARY,
    );
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.GET_PRIMARY_BANK_ACCOUNT,
    );
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.DELETE_MY_BANK_ACCOUNT,
    );
    // this.client.subscribeToResponseOf(BANK_ACCOUNT_PATTERNS.GET_DOCUMENTS);
    // this.client.subscribeToResponseOf(BANK_ACCOUNT_PATTERNS.UPLOAD_DOCUMENT);
    await this.client.connect();
  }
  async createBankAccount(identity: IdentityDto, dto: CreateBankAccountDto) {
    return await firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.CREATE_BANK_ACCOUNT, {
        ...dto,
        identityId: identity.identityId,
      }),
    );
  }
  async getMyBankAccounts(identity: IdentityDto) {
    return await firstValueFrom(
      this.client.send(
        BANK_ACCOUNT_PATTERNS.GET_MY_BANK_ACCOUNTS,
        identity.identityId,
      ),
    );
  }
  async getMyBankAccount(identity: IdentityDto, bankId: string) {
    return await firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.GET_MY_BANK_ACCOUNT, {
        identity: identity.identityId,
        bankId,
      }),
    );
  }
  async updateMyBankAccount(
    identity: IdentityDto,
    dto: UpdateBankAccountDto,
    bankId: string,
  ) {
    return await firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.UPDATE_MY_BANK_ACCOUNT, {
        identityId: identity.identityId,
        bankId,
        ...dto,
      }),
    );
  }
  async updateMyBankAccountStatus(
    identityId: string,
    bankId: string,
    dto: UpdateBankAccountStatusDto,
  ) {
    return await firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.UPDATE_BANK_ACCOUNT_STATUS, {
        identityId,
        bankId,
        ...dto,
      }),
    );
  }
  deleteMyBankAccount(dto: IdentityBankAccountDto) {
    return firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.DELETE_MY_BANK_ACCOUNT, dto),
    );
  }

  setMyBankAccountAsPrimary(identity: IdentityDto, bankId: string) {
    return firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.SET_BANK_ACCOUNT_AS_PRIMARY, {
        identity: identity.identityId,
        bankId,
      }),
    );
  }

  getMyPrimaryBankAccount(dto: IdentityDto) {
    return firstValueFrom(
      this.client.send(BANK_ACCOUNT_PATTERNS.GET_PRIMARY_BANK_ACCOUNT, dto),
    );
  }
}
