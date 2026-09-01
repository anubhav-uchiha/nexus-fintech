import { IsNotEmpty, IsString } from 'class-validator';

export class RequestProviderTransactionReversalRequestDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
