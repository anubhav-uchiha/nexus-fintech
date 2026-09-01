import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreditCommissionDistributionDto {
  @IsUUID()
  recipientUserId!: string;

  @IsString()
  @IsNotEmpty()
  recipientRole!: string;

  @IsString()
  @IsNotEmpty()
  commissionId!: string;

  @IsString()
  @IsNotEmpty()
  commissionReference!: string;

  @IsString()
  @IsNotEmpty()
  distributionTransactionId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  /*
   * CommissionDistributionTransaction
   * ka own unique idempotency key.
   */
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
