import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsUppercase, isUppercase } from 'class-validator';

export enum BankAccountStatusUpdate {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export class UpdateBankAccountStatusDto {
  @IsEnum(BankAccountStatusUpdate)
  @IsNotEmpty()
  @IsUppercase()
  status!: BankAccountStatusUpdate;
}
