import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';

export class VimopayBankIinRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsIn(['CW', 'BE', 'MS', 'AP', 'CD'])
  txnCode!: 'CW' | 'BE' | 'MS' | 'AP' | 'CD';

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsIn(['BA', 'FA'])
  authType!: 'BA' | 'FA';
}
