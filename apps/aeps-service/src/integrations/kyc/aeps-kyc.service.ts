import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { KYC_PATTERNS } from '@nexus/common/kyc/kyc.patterns';

import { firstValueFrom, timeout } from 'rxjs';

export const AEPS_KYC_CLIENT = 'AEPS_KYC_CLIENT';

interface AepsKycProfile {
  id: string;

  identityId: string;

  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

  submittedAt?: Date | string | null;

  reviewedAt?: Date | string | null;
}

@Injectable()
export class AepsKycService implements OnModuleInit {
  constructor(
    @Inject(AEPS_KYC_CLIENT)
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(KYC_PATTERNS.GET_MY_KYC);

    await this.client.connect();
  }

  async verifyApprovedKyc(
    identityId: string,
    kycProfileId: string,
  ): Promise<AepsKycProfile> {
    const kyc = await firstValueFrom(
      this.client
        .send<AepsKycProfile>(KYC_PATTERNS.GET_MY_KYC, identityId)
        .pipe(timeout(10000)),
    );

    if (!kyc) {
      throw new BadRequestException('KYC profile not found');
    }

    if (kyc.identityId !== identityId) {
      throw new BadRequestException(
        'Selected KYC does not belong to the logged-in identity',
      );
    }

    if (kyc.id !== kycProfileId) {
      throw new BadRequestException('Selected KYC profile is invalid');
    }

    if (kyc.status !== 'APPROVED') {
      throw new BadRequestException(
        'KYC must be approved before AEPS onboarding',
      );
    }

    return kyc;
  }
}
