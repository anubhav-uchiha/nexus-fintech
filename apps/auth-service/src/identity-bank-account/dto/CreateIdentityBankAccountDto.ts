import { IntersectionType } from '@nestjs/mapped-types';
import { CreateBankAccountDto } from '@nexus/common/identity-bank-account/dto/create-bank-account.dto';
import { IdentityDto } from 'libs/common/dto/IdentityDto';

export class CreateIdentityBankAccountDto extends IntersectionType(
  CreateBankAccountDto,
  IdentityDto,
) {}
