import { Injectable } from '@nestjs/common';
import { EkoService } from './providers/eko/eko.service';
import { BadRequestError } from 'libs/errors/ApiError';
import { PrismaService } from '../database/prisma.service';
import {
  BankAccountVerificationStatus,
  BankProvider,
} from 'apps/bank-service/generated/prisma/enums';

@Injectable()
export class BankVerificationService {
  constructor(
    private readonly ekoService: EkoService,
    private readonly prisma: PrismaService,
  ) {}

  async verifyBankAccount(dto: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
  }) {
    // perform switching here ..
    const { request, result, client_ref_id } =
      await this.ekoService.ekoBankVerification(dto);
    console.log('result is :', result);
    // return result;
    if (result.success) {
      // VERIFIED
      const attempt = await this.prisma.bankAccountVerification.create({
        data: {
          provider: BankProvider.EKO,
          accountHolderName: dto.accountHolderName,
          requestPayload: request,
          responsePayload: result.rawResponse,
          status: BankAccountVerificationStatus.VERIFIED,
          clientRefId: client_ref_id,
        },
      });
      return { request, result, attemptId: attempt.id };
    }

    if (result.status === 'REJECTED') {
      // account/provider rejected verification
      await this.prisma.bankAccountVerification.create({
        data: {
          provider: BankProvider.EKO,
          accountHolderName: dto.accountHolderName,
          requestPayload: request,
          responsePayload: result.rawResponse,
          status: BankAccountVerificationStatus.REJECTED,
          clientRefId: client_ref_id,
        },
      });

      throw new BadRequestError(
        result.errorMessage,
        result.errorType,
        result.errorCode?.toString() || 'Provider rejected verification',
      );
    }

    if (result.status === 'FAILED') {
      // technical/malformed/unexpected failure
      await this.prisma.bankAccountVerification.create({
        data: {
          provider: BankProvider.EKO,
          accountHolderName: dto.accountHolderName,
          requestPayload: request,
          responsePayload: result.rawResponse,
          status: BankAccountVerificationStatus.FAILED,
          clientRefId: client_ref_id,
        },
      });

      throw new BadRequestError(
        'An unexpected error occured',
        result.errorType,
        result.errorCode?.toString(),
      );
    }
    if (result.status === 'RETRYABLE') {
      // potentially try PaySprint
      console.log('trying paysprint');
    }
    throw new BadRequestError('Eko api failed to respond');
  }
}
