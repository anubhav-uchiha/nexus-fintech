import { Injectable } from '@nestjs/common';
import { CacheService } from 'libs/cache/src';
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
  BankAccountStatusUpdate,
  UpdateBankAccountStatusDto,
} from '@nexus/common/identity-bank-account/dto/update-bank-account-status.dto';
import { RpcException } from '@nestjs/microservices';
import { BadRequestError, NotFoundError } from 'libs/errors/ApiError';
import {
  BankAccountOwnershipStatus,
  BankAccountStatus,
  BankAccountVerificationStatus,
} from 'apps/bank-service/generated/prisma/enums';
import {
  UserBankAccountCreateInput,
  UserBankAccountUpdateInput,
} from 'apps/bank-service/generated/prisma/models';

import { BankVerificationService } from '../bank-verification/bank-verification.service';

@Injectable()
export class IdentityBankAccountService {
  constructor(
    private readonly cache: CacheService,
    private readonly bankRepositoryService: BankAccountRepository,
    private readonly bankVerificationService: BankVerificationService,
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
    console.log(account);
    if (account) {
      throw new BadRequestError(
        'Bank account already attached.',
        'account already attached',
        'BANK_ACCOUNT_NOT_ATTACHED',
      );
    }
    // if bank api returns invalid then return error from here otherwise add bank account
    const { result, attemptId } =
      await this.bankVerificationService.verifyBankAccount({
        accountHolderName: dto.accountHolderName,
        accountNumber: dto.accountNumber,
        ifsc: dto.ifsc,
      });

    const response = result;
    console.log(response);
    if (response.data?.accountStatus !== 'VALID') {
      throw new BadRequestError('Account does not seems to be valid.');
    }
    if (
      !response.data?.nameAtBank
        ?.toLowerCase()
        ?.includes(dto.accountHolderName.toLowerCase())
    ) {
      throw new BadRequestError(
        'Bank Account Ownership status failed.',
        {
          verificationStatus: 'failed',
        },
        'BANK_ACCOUNT_NOT_VALID',
      );
    }
    // for eko
    if (response.data?.accountStatusCode !== 'ACCOUNT_IS_VALID') {
      throw new BadRequestError(
        'Bank account not valid',
        {
          verificationStatus: 'failed',
        },
        'BANK_ACCOUNT_NOT_VALID',
      );
    }
    if (!response.data?.bankName || !response.data.branch) {
      throw new BadRequestError(
        'Bank account detials are incorrect.',
        {
          verificationStatus: 'failed',
        },
        'BANK_ACCOUNT_DETAILS_INVALID',
      );
    }

    const accountNumberEncrypted = encryptData(dto.accountNumber);

    const accountNumberLast4 = dto.accountNumber.slice(-4);
    const dataobj: UserBankAccountCreateInput = {
      identityId: dto.identityId,
      bankName: result.data?.bankName || dto.bankName,
      bankCode: result.data?.bankName,
      ifsc: dto.ifsc,
      branchName: result.data?.branch,
      accountHolderName: result.data?.nameAtBank || dto.accountHolderName,
      accountNumberEncrypted,
      accountNumberHash,
      accountNumberLast4,
      verificationStatus: BankAccountVerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      status: BankAccountStatus.ACTIVE,
      bankAccountVerifications: { connect: { id: attemptId } },
      ownershipStatus: BankAccountOwnershipStatus.VERIFIED,
      purposes: dto.purposes,
      accountType: dto.accountType,
      isDefault: false,
    };

    const identityBanksCount =
      await this.bankRepositoryService.getIdentityBankAccountsCount(
        dto.identityId,
      );
    if (identityBanksCount === 0) {
      dataobj.isDefault = true;
    }
    return this.bankRepositoryService.create(dataobj);
  }

  getMyBankAccounts(identity: string) {
    return this.bankRepositoryService.getIdentityBankAccounts(identity);
  }

  getMyBankAccount(dto: IdentityBankAccountDto) {
    return this.bankRepositoryService.getSingleBankAccount(dto);
  }

  provideDecryptedBankAccount(dto: IdentityBankAccountDto) {
    return this.bankRepositoryService.getBankAccountForInternalUse(dto);
  }

  async updateMyBankAccount(
    dto: UpdateBankAccountDto & { identityId: string; bankId: string },
  ) {
    console.log('dto in service', dto);
    const dataobj: UserBankAccountUpdateInput = {};
    if (dto.bankName) dataobj.bankName = dto.bankName;
    if (dto.bankCode) dataobj.bankCode = dto.bankCode;
    if (dto.purposes?.length) {
      dataobj.purposes = dto.purposes;
    }
    if (dto.accountType) {
      dataobj.accountType = dto.accountType;
    }

    if (dto.accountNumber) {
      if (!dto.ifsc) {
        throw new BadRequestError(
          'IFSC is required for account number updation.',
          'IFSC is required',
          'IFSC_IS_REQUIRED',
        );
      }
      if (!dto.accountHolderName) {
        throw new BadRequestError(
          'Account Holder name is required for account number updation.',
          'Account Holder name is required',
          'ACCOUNT_HOLDER_NAME_IS_REQUIRED',
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

      const { result, attemptId } =
        await this.bankVerificationService.verifyBankAccount({
          accountHolderName: dto.accountHolderName,
          accountNumber: dto.accountNumber,
          ifsc: dto.ifsc,
        });

      const response = result;
      console.log(response);
      if (response.data?.accountStatus !== 'VALID') {
        throw new BadRequestError('Account does not seems to be valid.');
      }
      if (
        !response.data?.nameAtBank
          ?.toLowerCase()
          ?.includes(dto.accountHolderName.toLowerCase())
      ) {
        throw new BadRequestError(
          'Bank Account Ownership status failed.',
          {
            verificationStatus: 'failed',
          },
          'BANK_ACCOUNT_NOT_VALID',
        );
      }
      // for eko
      if (response.data?.accountStatusCode !== 'ACCOUNT_IS_VALID') {
        throw new BadRequestError(
          'Bank account not valid',
          {
            verificationStatus: 'failed',
          },
          'BANK_ACCOUNT_NOT_VALID',
        );
      }

      const accountNumberEncrypted = encryptData(dto.accountNumber);
      const accountNumberLast4 = dto.accountNumber.slice(-4);
      dataobj.accountNumberEncrypted = accountNumberEncrypted;
      dataobj.accountNumberHash = accountNumberHash;
      dataobj.accountNumberLast4 = accountNumberLast4;
      dataobj.accountHolderName =
        response.data.nameAtBank || dto.accountHolderName;
      dataobj.branchName = response.data.branch;
      dataobj.bankName = response.data.bankName;
      //verifications
      dataobj.status = BankAccountStatus.ACTIVE;
      dataobj.verificationStatus = BankAccountVerificationStatus.VERIFIED;
      dataobj.ownershipStatus = BankAccountOwnershipStatus.VERIFIED;
      dataobj.verifiedAt = new Date();
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
        statusChangedById: dto.identityId,
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
