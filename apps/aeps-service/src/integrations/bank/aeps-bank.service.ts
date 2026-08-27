import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { BANK_ACCOUNT_PATTERNS } from '@nexus/common/identity-bank-account/identity-bank-account.patterns';

import { firstValueFrom, timeout } from 'rxjs';

export const AEPS_BANK_CLIENT = 'AEPS_BANK_CLIENT';

export interface AepsVerifiedBankAccount {
  id: string;

  identityId: string;

  bankName: string;

  bankCode?: string | null;

  ifsc: string;

  branchName?: string | null;

  accountHolderName: string;

  accountNumber: string;

  accountType: 'SAVINGS' | 'CURRENT' | 'SALARY';

  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

  verificationStatus:
    'PENDING' | 'PROCESSING' | 'VERIFIED' | 'REJECTED' | 'FAILED';

  ownershipStatus: 'PENDING' | 'VERIFIED' | 'FAILED';

  verifiedAt?: Date | string | null;

  isDefault: boolean;

  isDeleted: boolean;
}

@Injectable()
export class AepsBankService implements OnModuleInit {
  constructor(
    @Inject(AEPS_BANK_CLIENT)
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(
      BANK_ACCOUNT_PATTERNS.PROVIDE_DECRYPTED_BANK_ACCOUNT,
    );

    await this.client.connect();
  }

  async getVerifiedBankAccount(
    identityId: string,
    bankAccountId: string,
  ): Promise<AepsVerifiedBankAccount> {
    const bank = await firstValueFrom(
      this.client
        .send<AepsVerifiedBankAccount>(
          BANK_ACCOUNT_PATTERNS.PROVIDE_DECRYPTED_BANK_ACCOUNT,
          {
            identityId,

            bankId: bankAccountId,
          },
        )
        .pipe(timeout(10000)),
    );

    /*
     * Bank-service query already checks
     * identityId + bankId.
     *
     * Still, defence-in-depth ke liye
     * AEPS side dobara check kar rahi hai.
     */
    if (bank.identityId !== identityId) {
      throw new BadRequestException(
        'Selected bank account does not belong to the logged-in identity',
      );
    }

    if (bank.id !== bankAccountId) {
      throw new BadRequestException('Selected bank account is invalid');
    }

    if (bank.isDeleted) {
      throw new BadRequestException('Selected bank account is deleted');
    }

    if (bank.status !== 'ACTIVE') {
      throw new BadRequestException('Selected bank account is not active');
    }

    if (bank.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Selected bank account is not verified');
    }

    if (bank.ownershipStatus !== 'VERIFIED') {
      throw new BadRequestException(
        'Selected bank account ownership is not verified',
      );
    }

    if (!bank.accountNumber) {
      throw new BadRequestException(
        'Selected bank account number could not be resolved',
      );
    }

    return bank;
  }

  mapAccountTypeForVimopay(bank: AepsVerifiedBankAccount): string {
    switch (bank.accountType) {
      case 'SAVINGS':
        return 'Savings account';

      case 'CURRENT':
        return 'Current account';

      case 'SALARY':
        throw new BadRequestException(
          'Salary account is not supported for VimoPay AEPS onboarding',
        );

      default:
        throw new BadRequestException('Unsupported bank account type');
    }
  }
}
