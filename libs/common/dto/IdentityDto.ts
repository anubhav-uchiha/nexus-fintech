import { IntersectionType } from '@nestjs/mapped-types';
import { IsUUID } from 'class-validator';
import { Id7Dto } from './Id7Dto';

export class IdentityDto {
  @IsUUID('7', {
    message: 'identityId must be a valid UUID',
  })
  identityId!: string;
}
export class BankIdDto {
  @IsUUID('7', {
    message: 'bankId must be a valid UUID',
  })
  bankId!: string;
}

export class IdentityBankAccountDto extends IntersectionType(
  IdentityDto,
  BankIdDto,
) {}
