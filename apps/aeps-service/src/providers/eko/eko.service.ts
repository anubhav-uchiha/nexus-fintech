import { Injectable } from '@nestjs/common';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';
import {
  callEkoGetService,
  callEkoPostService,
} from './helpers/callEkoService';
import { MessagePattern } from '@nestjs/microservices';
import { BANK_ACCOUNT_PATTERNS } from '@nexus/common/identity-bank-account/identity-bank-account.patterns';

@Injectable()
export class EkoService {
  async getAllServices() {
    const initiator_id = process.env.EKO_INITIATOR_ID;
    const result = await callEkoGetService(
      `/tools/catalog/service-codes?initiator_id=${initiator_id}`,
    );
    console.log(result);
    return result;
  }

  async onboardUser(dto: OnboardEkoUserDto) {
    const initiator_id = process.env.EKO_INITIATOR_ID;
    if (!initiator_id) {
      throw new Error('initiator id is required for onboard user eko api call');
    }

    return await callEkoPostService('/users/network/eps-agent', {
      initiator_id,
      // user_code: dto.user_code,
      pan_number: dto.pan_number,
      mobile: dto.mobile,
      first_name: dto.first_name,
      last_name: dto.last_name,
      residence_address: dto.residence_address,
      email: dto.email,
      shop_name: dto.shop_name,
      dob: dto.dob,
    });
  }

  @MessagePattern(BANK_ACCOUNT_PATTERNS.GET_BANK_LIST)
  async getBankList() {
    const list = await callEkoGetService('/tools/reference/banks');
    return list;
  }
}
