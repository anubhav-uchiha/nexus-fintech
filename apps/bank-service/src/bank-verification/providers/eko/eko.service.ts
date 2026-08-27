import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  callEkoGetService,
  callEkoPostService,
} from '../../../eko-helpers/helpers/callEkoService';
import generateReferenceId from '../../../eko-helpers/helpers/referenceIdGenerator';
import { EKO_RESPONSE_TYPES } from 'apps/bank-service/src/eko-helpers/ResponseTypes';
import { EkoBankVerificationResponseHandler } from 'apps/bank-service/src/eko-helpers/helpers/eko-bank-verification-response.handler';

@Injectable()
export class EkoService {
  constructor(private readonly prisma: PrismaService) {}

  async ekoBankVerification(dto: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
  }) {
    const initiator_id = process.env.EKO_INITIATOR_ID;
    const user_code = process.env.EKO_USER_CODE;
    const client_ref_id = `BA-${generateReferenceId()}`;
    console.log(client_ref_id);
    const request = {
      initiator_id,
      user_code,
      bank_account: dto.accountNumber,
      ifsc: dto.ifsc,
      // client_ref_id,
    };
    const response = await callEkoPostService(
      '/tools/kyc/bank-account/sync',
      request,
    );
    const result = EkoBankVerificationResponseHandler.handle(response);

    return { request, result, client_ref_id };
  }
}
