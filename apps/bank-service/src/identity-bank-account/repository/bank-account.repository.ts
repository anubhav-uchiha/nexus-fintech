import { Injectable } from '@nestjs/common';

import {
  IdentityBankAccountDto,
  IdentityDto,
} from 'libs/common/dto/IdentityDto';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from 'apps/bank-service/generated/prisma/client';
import { UserBankStatusAuditCreateInput } from 'apps/bank-service/generated/prisma/models';
import { decryptData } from '../cryptoUtils/cryptography';
import { BadRequestError } from 'libs/errors/ApiError';

interface AccountNumberDecrypted {
  accountNumber: string;
}

@Injectable()
export class BankAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserBankAccountCreateInput) {
    return this.prisma.userBankAccount.create({
      data,
      select: {
        id: true,
        bankName: true,
        bankCode: true,
        ifsc: true,
        branchName: true,
        accountHolderName: true,
        accountNumberLast4: true,
        accountType: true,
        purposes: true,
        status: true,
        verificationStatus: true,
        ownershipStatus: true,
        verifiedAt: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  getIdentityBankAccountsCount(identity: string) {
    return this.prisma.userBankAccount.count({
      where: { identityId: identity, isDeleted: false },
    });
  }

  async getIdentityBankAccounts(identity: string) {
    return this.prisma.userBankAccount.findMany({
      where: { identityId: identity, isDeleted: false },
      select: {
        id: true,
        bankName: true,
        bankCode: true,
        ifsc: true,
        branchName: true,
        accountHolderName: true,
        accountNumberLast4: true,
        accountType: true,
        purposes: true,
        status: true,
        verificationStatus: true,
        ownershipStatus: true,
        verifiedAt: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  async getSingleBankAccount(dto: IdentityBankAccountDto) {
    const account = await this.prisma.userBankAccount.findFirst({
      where: {
        id: dto.bankId,
        identityId: dto.identityId,
      },
    });
    if (!account) {
      throw new BadRequestError(
        'Bank Account not found',
        'account not found.',
        'BANK_ACCOUNT_NOT_FOUND',
      );
    }
    return account;
  }

  async getBankAccountForInternalUse(dto: IdentityBankAccountDto) {
    const account = await this.prisma.userBankAccount.findFirst({
      where: {
        id: dto.bankId,
        identityId: dto.identityId,
        isDeleted: false,
      },

      select: {
        id: true,
        identityId: true,

        bankName: true,
        bankCode: true,

        ifsc: true,

        accountHolderName: true,

        accountNumberEncrypted: true,

        accountType: true,

        status: true,

        verificationStatus: true,

        ownershipStatus: true,

        isDefault: true,
      },
    });

    if (!account) {
      throw new BadRequestError(
        'Bank Account not found',
        'account not found.',
        'BANK_ACCOUNT_NOT_FOUND',
      );
    }

    return {
      id: account.id,
      identityId: account.identityId,

      bankName: account.bankName,
      bankCode: account.bankCode,

      ifsc: account.ifsc,

      accountHolderName: account.accountHolderName,

      accountNumber: decryptData(account.accountNumberEncrypted),

      accountType: account.accountType,

      status: account.status,

      verificationStatus: account.verificationStatus,

      ownershipStatus: account.ownershipStatus,

      isDefault: account.isDefault,
    };
  }

  getBankAccountByAccNoAndIfsc(dto: {
    accountNumberHash: string;
    ifsc: string;
  }) {
    return this.prisma.userBankAccount.findUnique({
      where: {
        accountNumberHash_ifsc: {
          accountNumberHash: dto.accountNumberHash,
          ifsc: dto.ifsc,
        },
      },
      select: {
        id: true,
        bankName: true,
        bankCode: true,
        ifsc: true,
        branchName: true,
        accountHolderName: true,
        accountNumberLast4: true,
        accountType: true,
        purposes: true,
        status: true,
        verificationStatus: true,
        ownershipStatus: true,
        verifiedAt: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }
  updateIdentityBankAccount(
    data: Prisma.UserBankAccountUpdateInput,
    identityId: string,
    bankId: string,
  ) {
    return this.prisma.userBankAccount.update({
      where: {
        id: bankId,
        identityId,
      },
      data,
      select: {
        id: true,
        bankName: true,
        bankCode: true,
        ifsc: true,
        branchName: true,
        accountHolderName: true,
        accountNumberLast4: true,
        accountType: true,
        purposes: true,
        status: true,
        verificationStatus: true,
        ownershipStatus: true,
        verifiedAt: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }
  async updateBankAccountStatusAndCreateAudit(
    identityId: string,
    bankId: string,
    audit: UserBankStatusAuditCreateInput,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const updatedAccount = await tx.userBankAccount.update({
        where: { id: bankId, identityId },
        data: {
          status: audit.newStatus,
          ...((audit.newStatus === 'INACTIVE' ||
            audit.newStatus === 'BLOCKED') && {
            isDefault: false,
          }),
        },
        select: {
          id: true,
          bankName: true,
          bankCode: true,
          ifsc: true,
          branchName: true,
          accountHolderName: true,
          accountNumberLast4: true,
          accountType: true,
          purposes: true,
          status: true,
          verificationStatus: true,
          ownershipStatus: true,
          verifiedAt: true,
          isDefault: true,
          createdAt: true,
        },
      });
      await tx.userBankStatusAudit.create({
        data: audit,
        select: { id: true },
      });
      return updatedAccount;
    });
  }
  delete(dto: IdentityBankAccountDto) {
    return this.prisma.userBankAccount.update({
      where: { id: dto.bankId, identityId: dto.identityId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async setPrimaryBankAccount(dto: IdentityBankAccountDto) {
    console.log(dto);
    return await this.prisma.$transaction(async (tx) => {
      await tx.userBankAccount.updateMany({
        where: {
          identityId: dto.identityId,
          NOT: {
            id: dto.bankId,
          },
        },
        data: {
          isDefault: false,
        },
      });
      const updated = await tx.userBankAccount.update({
        where: {
          identityId: dto.identityId,
          id: dto.bankId,
        },
        data: {
          isDefault: true,
        },
        select: {
          id: true,
          accountNumberLast4: true,
          isDefault: true,
        },
      });
      return updated;
    });
  }
  getPrimaryBankAccount(identity: IdentityDto) {
    return this.prisma.userBankAccount.findFirst({
      where: {
        identityId: identity.identityId,
        isDefault: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        bankName: true,
        bankCode: true,
        ifsc: true,
        branchName: true,
        accountHolderName: true,
        accountNumberLast4: true,
        accountType: true,
        purposes: true,
        status: true,
        verificationStatus: true,
        ownershipStatus: true,
        verifiedAt: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }
}
