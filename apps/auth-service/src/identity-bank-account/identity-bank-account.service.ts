import { Injectable } from '@nestjs/common';
import { IdentityService } from '../identity/identity.service';
import { RoleService } from '../role/role.service';
import { JwtService } from '../auth/jwt/jwt.service';
import { CacheService } from 'libs/cache/src';
import { SessionService } from '../session/session.service';
import { BankAccountRepository } from './repository/bank-account.repository';

import crypto from 'crypto';

import { CreateIdentityBankAccountDto } from './dto/CreateIdentityBankAccountDto';
import {
  IdentityBankAccountDto,
  IdentityDto,
} from 'libs/common/dto/IdentityDto';
import { encryptData } from './cryptoUtils/cryptography';
import { UpdateBankAccountDto } from '@nexus/common/identity-bank-account/dto/update-bank-account.dto';
import {
  UserBankAccountCreateInput,
  UserBankAccountUpdateInput,
} from 'apps/auth-service/generated/prisma/models';
import {
  BankAccountStatusUpdate,
  UpdateBankAccountStatusDto,
} from '@nexus/common/identity-bank-account/dto/update-bank-account-status.dto';
import { RpcException } from '@nestjs/microservices';
import { BadRequestError, NotFoundError } from 'libs/errors/ApiError';
import { BankAccountStatus } from 'apps/auth-service/generated/prisma/enums';

@Injectable()
export class IdentityBankAccountService {
  constructor(
    private readonly identityService: IdentityService,
    private readonly sessionService: SessionService,
    private readonly cache: CacheService,
    private readonly bankRepositoryService: BankAccountRepository,
  ) {}

  async addBankAccount(dto: CreateIdentityBankAccountDto) {
    console.log('bankaccountdtoReceived', dto.identityId);
    const accountNumberHash = crypto
      .createHash('sha256')
      .update(dto.accountNumber)
      .digest('hex');
    const account =
      await this.bankRepositoryService.getBankAccountByAccNoAndIfsc({
        accountNumberHash,
        ifsc: dto.ifsc,
      });
    if (account) {
      throw new NotFoundError(
        'Bank account already attached.',
        'account already attached',
        'BANK_ACCOUNT_NOT_ATTACHED',
      );
    }

    const accountNumberEncrypted = encryptData(dto.accountNumber);

    const accountNumberLast4 = dto.accountNumber.slice(-4);
    const dataobj: UserBankAccountCreateInput = {
      identity: { connect: { id: dto.identityId } },
      bankName: dto.bankName,
      bankCode: dto.bankCode,
      ifsc: dto.ifsc,
      branchName: dto.branchName,
      accountHolderName: dto.accountHolderName,
      accountNumberEncrypted,
      accountNumberHash,
      accountNumberLast4,
      purposes: dto.purposes,
      accountType: dto.accountType,
      isDefault: false,
    };
    // if bank api returns invalid then return error from here otherwise add bank account

    const identityBanksCount =
      await this.bankRepositoryService.getIdentityBankAccountsCount({
        identityId: dto.identityId,
      });
    if (identityBanksCount === 0) {
      dataobj.isDefault = true;
    }
    return this.bankRepositoryService.create(dataobj);
  }

  getMyBankAccounts(identity: IdentityDto) {
    return this.bankRepositoryService.getIdentityBankAccounts(identity);
  }

  getMyBankAccount(dto: IdentityBankAccountDto) {
    return this.bankRepositoryService.getSingleBankAccount(dto);
  }
  async updateMyBankAccount(
    dto: UpdateBankAccountDto & { identityId: string; bankId: string },
  ) {
    console.log('dto in service', dto);
    const dataobj: UserBankAccountUpdateInput = {};
    if (dto.bankName) dataobj.bankName = dto.bankName;
    if (dto.bankCode) dataobj.bankCode = dto.bankCode;
    if (dto.branchName) dataobj.branchName = dto.branchName;
    if (dto.accountHolderName)
      dataobj.accountHolderName = dto.accountHolderName;
    if (dto.accountNumber) {
      if (!dto.ifsc) {
        throw new BadRequestError(
          'IFSC is required for account number updation.',
          'IFSC is required',
          'IFSC_IS_REQUIRED',
        );
      }
      dataobj.ifsc = dto.ifsc;
      const accountNumberHash = crypto
        .createHash('sha256')
        .update(dto.accountNumber)
        .digest('hex');
      const account =
        await this.bankRepositoryService.getBankAccountByAccNoAndIfsc({
          accountNumberHash,
          ifsc: dto.ifsc,
        });
      if (account) {
        throw new BadRequestError(
          'Bank account already attached.',
          'account already attached',
          'BANK_ACCOUNT_NOT_ATTACHED',
        );
      }
      const accountNumberEncrypted = encryptData(dto.accountNumber);
      const accountNumberLast4 = dto.accountNumber.slice(-4);
      dataobj.accountNumberEncrypted = accountNumberEncrypted;
      dataobj.accountNumberHash = accountNumberHash;
      dataobj.accountNumberLast4 = accountNumberLast4;
    }
    if (dto.purposes?.length) {
      dataobj.purposes = dto.purposes;
    }
    if (dto.accountType) {
      dataobj.accountType = dto.accountType;
    }
    return this.bankRepositoryService.updateIdentityBankAccount(
      dataobj,
      dto.identityId,
      dto.bankId,
    );
  }

  async updateBankAccountStatus(
    dto: UpdateBankAccountStatusDto & { identityId: string; bankId: string },
  ) {
    const status = dto.status?.toUpperCase();
    const statuses = [...Object.values(BankAccountStatusUpdate)] as string[];
    if (dto.status === undefined || !statuses.includes(status)) {
      throw new BadRequestError(
        `status must be one of ${statuses.map((e) => e.toLowerCase()).join(', ')}`,
        'invalid status',
        'INVALID_STATUS',
      );
    }
    const account = await this.bankRepositoryService.getSingleBankAccount(dto);
    if (!account || account.deletedAt) {
      throw new NotFoundError(
        'Bank account not found.',
        'account not found',
        'BANK_ACCOUNT_NOT_FOUND',
      );
    }
    if (account.status === status) {
      throw new BadRequestError(
        `Status is already ${status.toLowerCase()}.`,
        `no changes in status`,
        `STATUS_SAME_ALREADY`,
      );
    }
    if (status === BankAccountStatusUpdate.ACTIVE) {
      if (account.ownershipStatus !== 'VERIFIED') {
        throw new BadRequestError(
          'Bank account ownership is not verified.',
          'account ownership not verified',
          'BANK_ACCOUNT_OWNERSHIP_NOT_VERIFIED',
        );
      }
      if (account.verificationStatus !== 'VERIFIED') {
        throw new BadRequestError(
          'Bank account is not verified.',
          'account ownership not verified',
          'BANK_ACCOUNT_OWNERSHIP_NOT_VERIFIED',
        );
      }
      if (!account.verifiedAt) {
        throw new BadRequestError(
          'Bank account is not verified.',
          'account ownership not verified',
          'BANK_ACCOUNT_OWNERSHIP_NOT_VERIFIED',
        );
      }
    }
    if (status === BankAccountStatusUpdate.INACTIVE) {
      if (account.status !== BankAccountStatusUpdate.ACTIVE) {
        throw new BadRequestError(
          'Bank account is not active.',
          'account not active',
          'BANK_ACCOUNT_NOT_ACTIVE',
        );
      }
    }
    return this.bankRepositoryService.updateBankAccountStatusAndCreateAudit(
      dto.identityId,
      dto.bankId,
      {
        oldStatus: account.status,
        newStatus: status as BankAccountStatus,
        bankAccount: { connect: { id: dto.bankId } },
        statusChangedBy: { connect: { id: dto.identityId } },
        changedAt: new Date(),
      },
    );
  }

  async deleteMyBankAccount(dto: IdentityBankAccountDto) {
    const account = await this.bankRepositoryService.getSingleBankAccount(dto);
    if (!account) {
      throw new NotFoundError(
        'Bank account not found.',
        'account not found',
        'BANK_ACCOUNT_NOT_FOUND',
      );
    }
    if (account.deletedAt) {
      throw new NotFoundError(
        'Bank account already deleted.',
        'account already deleted',
        'BANK_ACCOUNT_ALREADY_DELETED',
      );
    }
    return this.bankRepositoryService.delete(dto);
  }

  async setPrimaryBankAccount(dto: IdentityBankAccountDto) {
    const account = await this.bankRepositoryService.getSingleBankAccount(dto);
    if (!account || account.deletedAt) {
      throw new NotFoundError(
        'Bank account not found.',
        'account not found',
        'BANK_ACCOUNT_NOT_FOUND',
      );
    }
    if (account.status !== BankAccountStatus.ACTIVE) {
      throw new BadRequestError(
        'Bank account is not active.',
        'account not active',
        'BANK_ACCOUNT_NOT_ACTIVE',
      );
    }
    if (account.isDefault) {
      throw new BadRequestError(
        'Bank account already primary.',
        'account already primary',
        'BANK_ACCOUNT_ALREADY_PRIMARY',
      );
    }

    return this.bankRepositoryService.setPrimaryBankAccount(dto);
  }

  getPrimaryBankAccount(identity: IdentityDto) {
    return this.bankRepositoryService.getPrimaryBankAccount(identity);
  }
}
