import { IsNotEmpty, IsString } from 'class-validator';

export class CancelProviderCommissionDto {
  @IsString()
  @IsNotEmpty()
  commissionReference!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
