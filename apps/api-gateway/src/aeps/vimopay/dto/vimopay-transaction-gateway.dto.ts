import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

/*
 * ==========================================
 * COMMON BIOMETRIC TRANSACTION
 * ==========================================
 */

class VimopayBiometricTransactionDto {
  @IsString()
  @Matches(/^\d{12}$/)
  aadhaarNumber!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @IsString()
  @IsNotEmpty()
  bankIIN!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;

  @IsString()
  @IsNotEmpty()
  deviceType!: string;

  @IsString()
  @IsNotEmpty()
  pidData!: string;

  @IsOptional()
  @IsString()
  udf1?: string;

  @IsOptional()
  @IsString()
  udf2?: string;

  @IsOptional()
  @IsString()
  udf3?: string;
}

/*
 * BE
 */
export class VimopayBalanceEnquiryGatewayDto extends VimopayBiometricTransactionDto {}

/*
 * MS
 */
export class VimopayMiniStatementGatewayDto extends VimopayBiometricTransactionDto {}

/*
 * ==========================================
 * CASH WITHDRAWAL
 * ==========================================
 */

export class VimopayCashWithdrawalGatewayDto extends VimopayBiometricTransactionDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @IsOptional()
  @IsUUID()
  authRequestId?: string;
}

/*
 * ==========================================
 * AADHAAR PAY
 * ==========================================
 */

export class VimopayAadhaarPayGatewayDto extends VimopayBiometricTransactionDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @IsOptional()
  @IsUUID()
  authRequestId?: string;
}

/*
 * ==========================================
 * CASH DEPOSIT
 * ==========================================
 */

export class VimopayCashDepositGatewayDto extends VimopayBiometricTransactionDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;
}

/*
 * ==========================================
 * TXN OTP COMMON DTO
 * ==========================================
 */

class VimopayTransactionOtpGatewayDto {
  @IsString()
  @Matches(/^\d{12}$/)
  aadhaarNumber!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  custMobileNumber?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @IsString()
  @IsNotEmpty()
  bankIIN!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;

  @IsString()
  @IsNotEmpty()
  appPlatform!: string;

  @IsString()
  @IsNotEmpty()
  appVersion!: string;
}

export class VimopayCashWithdrawalOtpGatewayDto extends VimopayTransactionOtpGatewayDto {}

export class VimopayAadhaarPayOtpGatewayDto extends VimopayTransactionOtpGatewayDto {}
