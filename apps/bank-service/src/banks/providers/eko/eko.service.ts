import { Injectable } from '@nestjs/common';
import { PrismaService } from 'apps/bank-service/src/database/prisma.service';
import { callEkoGetService } from 'apps/bank-service/src/eko-helpers/helpers/callEkoService';
import { CacheService } from 'libs/cache/src';
import { BadRequestError } from 'libs/errors/ApiError';
import { error } from 'console';
import { EKO_RESPONSE_TYPES } from 'apps/bank-service/src/eko-helpers/ResponseTypes';

@Injectable()
export class EkoService {
  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async bankList() {
    const initiatorId = process.env.EKO_INITIATOR_ID;
    const userCode = process.env.EKO_USER_CODE;
    if (!initiatorId) {
      throw new Error('initiator id not present in .env');
    }
    const result = await callEkoGetService(
      `/tools/reference/banks?initiator_id=${initiatorId}&user_code=${userCode}`,
    );

    if (result.response_type_id === EKO_RESPONSE_TYPES.bankListResponse) {
      return {
        bankList: result.param_attributes.list_elements || [],
        message: result.message,
      };
    }
    throw new BadRequestError('Api failed to respond.');
  }
}
