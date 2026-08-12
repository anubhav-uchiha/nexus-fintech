import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BankAccountPurpose } from 'libs/common/enums/bank-account-purpose.enum';
import { BankAccountType } from 'libs/common/enums/bank-account-type.enum';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  bankName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankCode?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'Invalid IFSC code',
  })
  ifsc!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  branchName?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  accountHolderName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{9,18}$/, {
    message: 'Account number must contain 9 to 18 digits',
  })
  accountNumber!: string;

  @IsArray()
  @IsEnum(BankAccountPurpose, { each: true })
  purposes!: BankAccountPurpose[];

  @IsEnum(BankAccountType)
  @IsNotEmpty()
  accountType!: BankAccountType;
}
