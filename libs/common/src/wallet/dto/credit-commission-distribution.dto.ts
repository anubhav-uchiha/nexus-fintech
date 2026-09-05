import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

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

  /*
   * NEW:
   * Exact PTXN whose gross amount
   * funds this commission.
   */
  @IsString()
  @IsNotEmpty()
  providerTransactionReference!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}