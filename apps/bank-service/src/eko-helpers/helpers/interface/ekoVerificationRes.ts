import { Prisma } from "apps/bank-service/generated/prisma/client";

export type EkoBankVerificationStatus =
  'VERIFIED' | 'REJECTED' | 'RETRYABLE' | 'FAILED';

export type EkoBankVerificationErrorType =
  'NONE' | 'VALIDATION' | 'AUTHENTICATION' | 'PROVIDER' | 'ACCOUNT' | 'UNKNOWN';

export interface EkoBankVerificationData {
  utr?: string;
  referenceId?: number;
  city?: string;
  bankName?: string;
  micr?: number;
  accountStatusCode: string;
  accountStatus: string;
  nameAtBank?: string;
  branch?: string;
}

export interface EkoBankVerificationResult {
  success: boolean;

  status: EkoBankVerificationStatus;

  errorType: EkoBankVerificationErrorType;

  errorCode?: string | number;

  errorMessage?: string;

  data?: EkoBankVerificationData;

  rawResponse: Prisma.InputJsonValue;
}
