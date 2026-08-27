import { Prisma } from 'apps/bank-service/generated/prisma/browser';
import { EKO_BANK_ERRORS } from './eko.errors';
import {
  EkoBankVerificationResult,
  EkoBankVerificationData,
} from './interface/ekoVerificationRes';

export class EkoBankVerificationResponseHandler {
  static handle(response: unknown): EkoBankVerificationResult {
    /**
     * ----------------------------------------------------
     * 1. Validate response itself
     * ----------------------------------------------------
     */
    if (!response || typeof response !== 'object') {
      return this.failed(
        'INVALID_RESPONSE',
        'Invalid response received from Eko',
        response,
      );
    }

    const body = response as Record<string, unknown>;

    /**
     * ----------------------------------------------------
     * 2. Validate required top-level Eko fields
     * ----------------------------------------------------
     */
    const status = body.status;
    const responseStatusId = body.response_status_id;
    const responseTypeId = body.response_type_id;

    if (typeof status !== 'number') {
      return this.failed(
        'MALFORMED_RESPONSE',
        'Eko response contains invalid status',
        response,
      );
    }

    if (typeof responseStatusId !== 'number') {
      return this.failed(
        'MALFORMED_RESPONSE',
        'Eko response contains invalid response_status_id',
        response,
      );
    }

    if (typeof responseTypeId !== 'number') {
      return this.failed(
        'MALFORMED_RESPONSE',
        'Eko response contains invalid response_type_id',
        response,
      );
    }

    /**
     * ----------------------------------------------------
     * 3. Validate response_status_id
     * ----------------------------------------------------
     *
     * For a successful response it should normally be 0.
     *
     * If Eko returns another value, don't pretend that
     * the verification succeeded.
     */
    if (responseStatusId !== 0) {
      return this.failed(
        responseStatusId,
        'Eko returned a non-success response_status_id',
        response,
      );
    }

    /**
     * ----------------------------------------------------
     * 4. Handle Eko status errors
     * ----------------------------------------------------
     */
    if (status !== 0) {
      return this.handleEkoError(body, status);
    }

    /**
     * ----------------------------------------------------
     * 5. Successful Eko response must contain data
     * ----------------------------------------------------
     */
    if (!body.data || typeof body.data !== 'object') {
      return this.failed(
        'MISSING_DATA',
        'Eko successful response does not contain data',
        response,
      );
    }

    const data = body.data as Record<string, unknown>;

    /**
     * ----------------------------------------------------
     * 6. Validate account status
     * ----------------------------------------------------
     */
    if (typeof data.account_status !== 'string') {
      return this.failed(
        'INVALID_ACCOUNT_STATUS',
        'Eko response contains invalid account_status',
        response,
      );
    }

    if (typeof data.account_status_code !== 'string') {
      return this.failed(
        'INVALID_ACCOUNT_STATUS_CODE',
        'Eko response contains invalid account_status_code',
        response,
      );
    }

    /**
     * ----------------------------------------------------
     * 7. Normalize bank verification data
     * ----------------------------------------------------
     */
    const verificationData: EkoBankVerificationData = {
      utr: this.toString(data.utr),

      referenceId: this.toNumber(data.reference_id),

      city: this.toString(data.city),

      bankName: this.toString(data.bank_name),

      micr: this.toNumber(data.micr),

      accountStatusCode: data.account_status_code,

      accountStatus: data.account_status,

      nameAtBank: this.toString(data.name_at_bank),

      branch: this.toString(data.branch),
    };

    /**
     * ----------------------------------------------------
     * 8. Determine actual bank verification result
     * ----------------------------------------------------
     */
    if (data.account_status === 'VALID') {
      return {
        success: true,
        status: 'VERIFIED',
        errorType: 'NONE',
        data: verificationData,
        rawResponse: response,
      };
    }

    /**
     * ----------------------------------------------------
     * 9. Account verification failed
     * ----------------------------------------------------
     */
    return {
      success: false,
      status: 'REJECTED',
      errorType: 'ACCOUNT',
      errorCode: data.account_status_code,
      errorMessage: data.account_status,
      data: verificationData,
      rawResponse: response,
    };
  }
  private static toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Handle Eko status-level errors.
   */
  private static handleEkoError(
    body: Record<string, unknown>,
    errorCode: number,
  ): EkoBankVerificationResult {
    const error = EKO_BANK_ERRORS[String(errorCode)];

    /**
     * Unknown Eko error
     */
    if (!error) {
      return this.failed(
        errorCode,
        'Unknown Eko bank verification error',
        body,
      );
    }

    /**
     * Known Eko error
     */
    return {
      success: false,

      status: error.retryable ? 'RETRYABLE' : 'REJECTED',

      errorType: error.type,

      errorCode,

      errorMessage: error.message,

      rawResponse: this.toJson(body),
    };
  }

  /**
   * Generic failed response.
   */
  private static failed(
    errorCode: string | number,
    errorMessage: string,
    rawResponse: unknown,
  ): EkoBankVerificationResult {
    return {
      success: false,
      status: 'FAILED',
      errorType: 'UNKNOWN',
      errorCode,
      errorMessage,
      rawResponse: this.toJson(rawResponse),
    };
  }

  private static toString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private static toNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }
}
