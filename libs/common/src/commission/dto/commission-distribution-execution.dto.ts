import { IsNotEmpty, IsString } from 'class-validator';

export class GetProviderCommissionExecutionDto {
  @IsString()
  @IsNotEmpty()
  commissionReference!: string;
}

export class MarkCommissionDistributionSuccessDto {
  @IsString()
  @IsNotEmpty()
  distributionTransactionId!: string;

  @IsString()
  @IsNotEmpty()
  walletTransactionId!: string;

  @IsString()
  @IsNotEmpty()
  walletTransactionReference!: string;
}

export class MarkCommissionDistributionFailedDto {
  @IsString()
  @IsNotEmpty()
  distributionTransactionId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class FinalizeProviderDistributionsDto {
  @IsString()
  @IsNotEmpty()
  commissionReference!: string;
}
