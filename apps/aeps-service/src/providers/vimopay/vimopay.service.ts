import {
  BadGatewayException,
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VimopayMerchantRegistrationDto } from './dto/merchant-registration.dto';
import {
  VIMOPAY_ENDPOINTS,
  VIMOPAY_RESPONSE_CODES,
} from './constants/vimopay.constants';

import {
  VimopayBank,
  VimopayBankIin,
  VimopayDistrict,
  VimopayEncryptedResponse,
  VimopayMerchantRegistrationResponse,
  VimopayState,
  VimopayMerchantOtpResponse,
  VimopayMerchantEkycResponse,
  VimopayTwoFactorAuthResponse,
  VimopayBalanceEnquiryResponse,
  VimopayMiniStatementResponse,
  VimopayCashWithdrawalResponse,
  VimopayAepsTransactionOtpResponse,
  VimopayAadhaarPayResponse,
  VimopayCashDepositResponse,
} from './interfaces/vimopay-response.interface';
import {
  VimopayMerchantOtpDto,
  VimopayValidateMerchantOtpDto,
} from './dto/merchant-otp.dto';

import { VimopayAuthService } from './vimopay-auth.service';
import { VimopayClientService } from './vimopay-client.service';
import { VimopayCryptoService } from './vimopay-crypto.service';

import { VimopayMerchantEkycDto } from './dto/merchant-ekyc.dto';
import { VimopayTwoFactorAuthDto } from './dto/two-factor-auth.dto';
import { VimopayBalanceEnquiryDto } from './dto/balance-enquiry.dto';
import { VimopayMiniStatementDto } from './dto/mini-statement.dto';
import { VimopayCashWithdrawalDto } from './dto/cash-withdrawal.dto';
import { VimopayAepsTransactionOtpDto } from './dto/aeps-transaction-otp.dto';
import { VimopayAadhaarPayDto } from './dto/aadhaar-pay.dto';
import { VimopayCashDepositDto } from './dto/cash-deposit.dto';
import { VimopayDistrictRequestDto } from './dto/district-request.dto';
import { VimopayBankIinRequestDto } from './dto/bank-iin-request.dto';

@Injectable()
export class VimopayService {
  private readonly logger = new Logger(VimopayService.name);
  constructor(
    private readonly authService: VimopayAuthService,
    private readonly client: VimopayClientService,
    private readonly crypto: VimopayCryptoService,
    private readonly configService: ConfigService,
  ) {}

  async authorize() {
    return this.authService.authorize();
  }

  /*
   * ------------------------------------------------
   * BANK LIST
   * ------------------------------------------------
   */
  async getBankList(): Promise<VimopayBank[]> {
    return this.getEncryptedList<VimopayBank>(
      VIMOPAY_ENDPOINTS.BANK_LIST,
      'bank list',
    );
  }

  /*
   * ------------------------------------------------
   * STATE LIST
   * ------------------------------------------------
   */
  async getStateList(): Promise<VimopayState[]> {
    return this.getEncryptedList<VimopayState>(
      VIMOPAY_ENDPOINTS.STATE_LIST,
      'state list',
    );
  }

  /*
   * ------------------------------------------------
   * DISTRICT LIST
   * ------------------------------------------------
   */
  async getDistrictList(
    payload: VimopayDistrictRequestDto,
  ): Promise<VimopayDistrict[]> {
    return this.postEncryptedList<VimopayDistrict, VimopayDistrictRequestDto>(
      VIMOPAY_ENDPOINTS.DISTRICT_LIST,
      payload,
      'district list',
    );
  }

  /*
   * ------------------------------------------------
   * BANK IIN LIST
   * ------------------------------------------------
   */
  async getBankIinList(
    payload: VimopayBankIinRequestDto,
  ): Promise<VimopayBankIin[]> {
    return this.postEncryptedList<VimopayBankIin, VimopayBankIinRequestDto>(
      VIMOPAY_ENDPOINTS.BANK_IIN_LIST,
      payload,
      'bank IIN list',
    );
  }

  /*
   * ------------------------------------------------
   * COMMON GET HANDLER
   *
   * Bank List
   * State List
   * ------------------------------------------------
   */
  private async getEncryptedList<T>(
    endpoint: string,
    resourceName: string,
  ): Promise<T[]> {
    const response =
      await this.authenticatedGet<VimopayEncryptedResponse>(endpoint);

    this.validateProviderResponse(response, resourceName);

    return this.decryptResponseData<T[]>(response, resourceName);
  }

  /*
   * ------------------------------------------------
   * COMMON ENCRYPTED POST HANDLER
   *
   * District
   * Bank IIN
   * Future:
   * Merchant registration
   * OTP
   * E-KYC
   * 2FA
   * Transaction
   * ------------------------------------------------
   */
  private async postEncryptedList<TResponse, TPayload>(
    endpoint: string,
    payload: TPayload,
    resourceName: string,
  ): Promise<TResponse[]> {
    /*
     * Plain payload:
     *
     * {
     *   stateCode: 'DL'
     * }
     *
     * becomes:
     *
     * {
     *   requestBody: '<encrypted value>'
     * }
     */
    const encryptedBody = this.crypto.encryptRequestBody(payload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      endpoint,
      encryptedBody,
    );

    this.validateProviderResponse(response, resourceName);

    return this.decryptResponseData<TResponse[]>(response, resourceName);
  }

  /*
   * ------------------------------------------------
   * COMMON VIMOPAY RESPONSE VALIDATION
   * ------------------------------------------------
   */
  private validateProviderResponse(
    response: VimopayEncryptedResponse,
    resourceName: string,
  ): void {
    if (
      !response.successStatus ||
      response.responseCode !== VIMOPAY_RESPONSE_CODES.SUCCESS
    ) {
      throw new BadGatewayException({
        message: response.message || `Unable to fetch VimoPay ${resourceName}`,

        responseCode: response.responseCode,
      });
    }

    if (!response.data) {
      throw new BadGatewayException({
        message: `VimoPay ${resourceName} response does not contain data`,

        responseCode: response.responseCode,
      });
    }
  }

  /*
   * ------------------------------------------------
   * COMMON DECRYPTION
   * ------------------------------------------------
   */
  private decryptResponseData<T>(
    response: VimopayEncryptedResponse,
    resourceName: string,
  ): T {
    if (!response.data) {
      throw new BadGatewayException(
        `VimoPay ${resourceName} response data is empty`,
      );
    }

    return this.crypto.decryptJson<T>(response.data);
  }

  async registerMerchant(
    payload: VimopayMerchantRegistrationDto,
  ): Promise<VimopayMerchantRegistrationResponse> {
    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      ...payload,

      middleName: payload.middleName ?? '',

      merchantAddress2: payload.merchantAddress2 ?? '',

      pipe,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.MERCHANT_ONBOARD,
      encryptedBody,
    );

    if (
      !response.successStatus ||
      response.responseCode !== VIMOPAY_RESPONSE_CODES.SUCCESS
    ) {
      throw new BadGatewayException({
        message: response.message || 'VimoPay merchant registration failed',

        responseCode: response.responseCode,
      });
    }

    if (!response.data) {
      throw new BadGatewayException(
        'VimoPay merchant registration response does not contain data',
      );
    }

    const result = this.crypto.decryptJson<VimopayMerchantRegistrationResponse>(
      response.data,
    );

    /*
     * Outer API successful ho sakti hai,
     * lekin decrypted business response failed
     * ho sakta hai.
     */
    if (result.status && result.status !== VIMOPAY_RESPONSE_CODES.SUCCESS) {
      throw new BadRequestException({
        message:
          result.statusDescription || 'VimoPay merchant registration failed',

        providerStatus: result.status,

        merchantStatus: result.merchantStatus,

        merchantRefId: result.merchantRefId,
      });
    }

    if (!result.merchantId) {
      throw new InternalServerErrorException(
        'VimoPay registration succeeded but merchantId was not received',
      );
    }

    return result;
  }

  private async executeMerchantOtpRequest(
    endpoint: string,
    payload: VimopayMerchantOtpDto | VimopayValidateMerchantOtpDto,
    actionName: string,
  ): Promise<VimopayMerchantOtpResponse> {
    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      ...payload,
      pipe,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      endpoint,
      encryptedBody,
    );

    if (
      !response.successStatus ||
      response.responseCode !== VIMOPAY_RESPONSE_CODES.SUCCESS
    ) {
      throw new BadGatewayException({
        message: response.message || `Unable to ${actionName}`,

        responseCode: response.responseCode,
      });
    }

    if (!response.data) {
      throw new BadGatewayException(
        `VimoPay ${actionName} response does not contain data`,
      );
    }

    const result = this.crypto.decryptJson<VimopayMerchantOtpResponse>(
      response.data,
    );

    if (result.status !== VIMOPAY_RESPONSE_CODES.SUCCESS) {
      throw new BadRequestException({
        message: result.statusDescription || `Unable to ${actionName}`,

        providerStatus: result.status,

        merchantStatus: result.merchantStatus,

        merchantId: result.merchantId,

        merchantRefId: result.merchantRefId,
      });
    }

    return result;
  }

  async sendMerchantOtp(
    payload: VimopayMerchantOtpDto,
  ): Promise<VimopayMerchantOtpResponse> {
    return this.executeMerchantOtpRequest(
      VIMOPAY_ENDPOINTS.SEND_OTP,
      payload,
      'send OTP',
    );
  }

  async resendMerchantOtp(
    payload: VimopayMerchantOtpDto,
  ): Promise<VimopayMerchantOtpResponse> {
    return this.executeMerchantOtpRequest(
      VIMOPAY_ENDPOINTS.RESEND_OTP,
      payload,
      'resend OTP',
    );
  }

  async validateMerchantOtp(
    payload: VimopayValidateMerchantOtpDto,
  ): Promise<VimopayMerchantOtpResponse> {
    return this.executeMerchantOtpRequest(
      VIMOPAY_ENDPOINTS.VALIDATE_OTP,
      payload,
      'validate OTP',
    );
  }

  async merchantEkyc(
    payload: VimopayMerchantEkycDto,
  ): Promise<VimopayMerchantEkycResponse> {
    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantId: payload.merchantId,
      merchantRefId: payload.merchantRefId,
      pipe,
      pidData: payload.pidData,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.MERCHANT_EKYC,
      encryptedBody,
    );

    if (
      !response.successStatus ||
      response.responseCode !== VIMOPAY_RESPONSE_CODES.SUCCESS
    ) {
      throw new BadGatewayException({
        message: response.message || 'VimoPay merchant E-KYC failed',

        responseCode: response.responseCode,
      });
    }

    if (!response.data) {
      throw new BadGatewayException(
        'VimoPay E-KYC response does not contain data',
      );
    }

    const result = this.crypto.decryptJson<VimopayMerchantEkycResponse>(
      response.data,
    );

    if (result.status !== VIMOPAY_RESPONSE_CODES.SUCCESS) {
      throw new BadRequestException({
        message: result.statusDescription || 'Merchant E-KYC failed',
        providerStatus: result.status,
        merchantStatus: result.merchantStatus,
        merchantId: result.merchantId,
        merchantRefId: result.merchantRefId,
      });
    }

    return result;
  }

  async twoFactorAuth(
    payload: VimopayTwoFactorAuthDto,
  ): Promise<VimopayTwoFactorAuthResponse> {
    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantId: payload.merchantId,
      merchantRefId: payload.merchantRefId,
      aadhaarNumber: payload.aadhaarNumber,
      deviceType: payload.deviceType,
      pidData: payload.pidData,
      lat: payload.lat,
      long: payload.long,
      pipe,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.TWO_FACTOR_AUTH,
      encryptedBody,
    );

    if (
      !response.successStatus ||
      response.responseCode !== VIMOPAY_RESPONSE_CODES.SUCCESS
    ) {
      throw new BadGatewayException({
        message: response.message || 'VimoPay 2FA failed',
        responseCode: response.responseCode,
      });
    }

    if (!response.data) {
      throw new BadGatewayException(
        'VimoPay 2FA response does not contain data',
      );
    }

    const result = this.crypto.decryptJson<VimopayTwoFactorAuthResponse>(
      response.data,
    );

    if (result.status !== VIMOPAY_RESPONSE_CODES.SUCCESS) {
      throw new BadRequestException({
        message: result.statusDescription || 'VimoPay 2FA failed',
        providerStatus: result.status,
        merchantStatus: result.merchantStatus,
        merchantId: result.merchantId,
        merchantRefId: result.merchantRefId,
      });
    }

    return result;
  }

  async balanceEnquiry(
    payload: VimopayBalanceEnquiryDto,
  ): Promise<VimopayBalanceEnquiryResponse> {
    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantRefId: payload.merchantRefId,
      merchantId: payload.merchantId,

      transactionType: 'BE',

      aadhaarNumber: payload.aadhaarNumber,
      mobileNumber: payload.mobileNumber,

      /*
       * PDF:
       * Balance Enquiry amount always 0.
       */
      amount: '0',

      bankIIN: payload.bankIIN,

      ipAddress: payload.ipAddress,

      pipe,

      lat: payload.lat,
      long: payload.long,

      deviceType: payload.deviceType,

      /*
       * BE mein transaction OTP required nahi hai.
       * Field ko empty bhej rahe hain because main
       * transaction table cwAuthTxnId list karti hai.
       */
      cwAuthTxnId: payload.cwAuthTxnId ?? '',

      udf1: payload.udf1 ?? '',
      udf2: payload.udf2 ?? '',
      udf3: payload.udf3 ?? '',

      pidData: payload.pidData,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.AEPS_TRANSACTION,
      encryptedBody,
    );

    if (!response.data) {
      throw new BadGatewayException({
        message:
          response.message ||
          'VimoPay Balance Enquiry response does not contain data',

        responseCode: response.responseCode,
      });
    }

    const result = this.crypto.decryptJson<VimopayBalanceEnquiryResponse>(
      response.data,
    );

    /*
     * Abhi provider ka decrypted response as-is return
     * karenge.
     *
     * Transactions mein future mein status:
     * 000 success
     * 001 failed
     * 002 pending
     * 003 validation failed
     *
     * ko properly persist/map karenge.
     */
    return result;
  }
  async miniStatement(
    payload: VimopayMiniStatementDto,
  ): Promise<VimopayMiniStatementResponse> {
    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantRefId: payload.merchantRefId,
      merchantId: payload.merchantId,

      transactionType: 'MS',

      aadhaarNumber: payload.aadhaarNumber,
      mobileNumber: payload.mobileNumber,

      // Mini Statement ke liye amount 0
      amount: '0',

      bankIIN: payload.bankIIN,

      ipAddress: payload.ipAddress,

      pipe,

      lat: payload.lat,
      long: payload.long,

      deviceType: payload.deviceType,

      cwAuthTxnId: payload.cwAuthTxnId ?? '',

      udf1: payload.udf1 ?? '',
      udf2: payload.udf2 ?? '',
      udf3: payload.udf3 ?? '',

      pidData: payload.pidData,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.AEPS_TRANSACTION,
      encryptedBody,
    );

    if (!response.data) {
      throw new BadGatewayException({
        message:
          response.message ||
          'VimoPay Mini Statement response does not contain data',

        responseCode: response.responseCode,
      });
    }

    return this.crypto.decryptJson<VimopayMiniStatementResponse>(response.data);
  }

  async cashWithdrawal(
    payload: VimopayCashWithdrawalDto,
  ): Promise<VimopayCashWithdrawalResponse> {
    const amount = Number(payload.amount);

    if (!Number.isFinite(amount) || amount < 100 || amount > 10000) {
      throw new BadRequestException(
        'Cash Withdrawal amount must be between 100 and 10000',
      );
    }

    /*
     * Docs ke according CW/AP > 5000 par
     * AePS Transaction OTP required hai.
     */
    if (amount > 5000 && !payload.cwAuthTxnId?.trim()) {
      throw new BadRequestException(
        'cwAuthTxnId is required for Cash Withdrawal above 5000',
      );
    }

    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantRefId: payload.merchantRefId,
      merchantId: payload.merchantId,

      transactionType: 'CW',

      aadhaarNumber: payload.aadhaarNumber,
      mobileNumber: payload.mobileNumber,

      amount: payload.amount,
      bankIIN: payload.bankIIN,

      ipAddress: payload.ipAddress,

      pipe,

      lat: payload.lat,
      long: payload.long,

      deviceType: payload.deviceType,

      cwAuthTxnId: payload.cwAuthTxnId ?? '',

      udf1: payload.udf1 ?? '',
      udf2: payload.udf2 ?? '',
      udf3: payload.udf3 ?? '',

      pidData: payload.pidData,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.AEPS_TRANSACTION,
      encryptedBody,
    );

    if (!response.data) {
      throw new BadGatewayException({
        message:
          response.message ||
          'VimoPay Cash Withdrawal response does not contain data',

        responseCode: response.responseCode,
      });
    }

    return this.crypto.decryptJson<VimopayCashWithdrawalResponse>(
      response.data,
    );
  }

  async sendAepsTransactionOtp(
    payload: VimopayAepsTransactionOtpDto,
  ): Promise<VimopayAepsTransactionOtpResponse> {
    const amount = Number(payload.amount);

    if (!Number.isFinite(amount) || amount <= 5000 || amount > 10000) {
      throw new BadRequestException(
        'AePS Transaction OTP is required for amount above 5000 and up to 10000',
      );
    }

    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantRefId: payload.merchantRefId,

      merchantId: payload.merchantId,

      bankIIN: payload.bankIIN,

      aadhaarNumber: payload.aadhaarNumber,

      transactionType: payload.transactionType,

      amount: payload.amount,

      mobileNumber: payload.mobileNumber,

      custMobileNumber: payload.custMobileNumber ?? '',

      lat: payload.lat,

      long: payload.long,

      ipAddress: payload.ipAddress,

      pipe,

      appPlatform: payload.appPlatform,

      appVersion: payload.appVersion,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.AEPS_TRANSACTION_OTP,
      encryptedBody,
    );

    if (!response.data) {
      throw new BadGatewayException({
        message:
          response.message ||
          'VimoPay AePS Transaction OTP response does not contain data',

        responseCode: response.responseCode,
      });
    }

    return this.crypto.decryptJson<VimopayAepsTransactionOtpResponse>(
      response.data,
    );
  }

  async aadhaarPay(
    payload: VimopayAadhaarPayDto,
  ): Promise<VimopayAadhaarPayResponse> {
    const amount = Number(payload.amount);

    if (!Number.isFinite(amount) || amount < 100 || amount > 10000) {
      throw new BadRequestException(
        'Aadhaar Pay amount must be between 100 and 10000',
      );
    }

    /*
     * Docs ke according AP > 5000 par
     * AePS Transaction OTP flow use hoga.
     */
    if (amount > 5000 && !payload.cwAuthTxnId?.trim()) {
      throw new BadRequestException(
        'cwAuthTxnId is required for Aadhaar Pay above 5000',
      );
    }

    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantRefId: payload.merchantRefId,

      merchantId: payload.merchantId,

      transactionType: 'AP',

      aadhaarNumber: payload.aadhaarNumber,

      mobileNumber: payload.mobileNumber,

      amount: payload.amount,

      bankIIN: payload.bankIIN,

      ipAddress: payload.ipAddress,

      pipe,

      lat: payload.lat,

      long: payload.long,

      deviceType: payload.deviceType,

      cwAuthTxnId: payload.cwAuthTxnId ?? '',

      udf1: payload.udf1 ?? '',

      udf2: payload.udf2 ?? '',

      udf3: payload.udf3 ?? '',

      pidData: payload.pidData,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.AEPS_TRANSACTION,
      encryptedBody,
    );

    if (!response.data) {
      throw new BadGatewayException({
        message:
          response.message ||
          'VimoPay Aadhaar Pay response does not contain data',

        responseCode: response.responseCode,
      });
    }

    return this.crypto.decryptJson<VimopayAadhaarPayResponse>(response.data);
  }

  private async authenticatedGet<T>(endpoint: string): Promise<T> {
    return this.executeWithAuthRetry<T>(async (headers) => {
      return this.client.get<T>(endpoint, {
        headers,
      });
    });
  }

  private async authenticatedPost<T>(
    endpoint: string,
    body: unknown,
  ): Promise<T> {
    return this.executeWithAuthRetry<T>(async (headers) => {
      return this.client.post<T>(endpoint, body, {
        headers,
      });
    });
  }

  private async executeWithAuthRetry<T>(
    request: (headers: Record<string, string>) => Promise<T>,
  ): Promise<T> {
    const headers = await this.authService.getAuthenticatedHeaders();

    try {
      return await request(headers);
    } catch (error: unknown) {
      if (!this.isVimopayUnauthorizedError(error)) {
        throw error;
      }

      /*
       * IMPORTANT:
       * VimoPay rejected cached token.
       *
       * Token clear karo.
       * Fresh authorization automatically hogi.
       * Same API exactly ONE TIME retry hogi.
       */
      this.logger.warn(
        'VimoPay returned 401. Refreshing bearer token and retrying request once.',
      );

      this.authService.clearToken();

      const freshHeaders = await this.authService.getAuthenticatedHeaders();

      /*
       * No try/catch here intentionally.
       *
       * Agar second request bhi fail hoti hai,
       * actual error caller ko return hoga.
       *
       * Infinite retry nahi hogi.
       */
      return request(freshHeaders);
    }
  }

  private isVimopayUnauthorizedError(error: unknown): boolean {
    if (!(error instanceof BadGatewayException)) {
      return false;
    }

    const response = error.getResponse();

    if (!response || typeof response !== 'object') {
      return false;
    }

    const payload = response as Record<string, unknown>;

    /*
     * vimopay-client.service.ts currently returns:
     *
     * {
     *   message: 'VimoPay API request failed',
     *   providerStatusCode: 401,
     *   providerResponse: {
     *      responseCode: '401'
     *   }
     * }
     */

    if (Number(payload.providerStatusCode) === 401) {
      return true;
    }

    const providerResponse = payload.providerResponse;

    if (providerResponse && typeof providerResponse === 'object') {
      const providerPayload = providerResponse as Record<string, unknown>;

      return String(providerPayload.responseCode ?? '') === '401';
    }

    return false;
  }

  async cashDeposit(
    payload: VimopayCashDepositDto,
  ): Promise<VimopayCashDepositResponse> {
    const amount = Number(payload.amount);

    if (!Number.isFinite(amount) || amount < 100 || amount > 10000) {
      throw new BadRequestException(
        'Cash Deposit amount must be between 100 and 10000',
      );
    }

    const pipe = this.configService.get<string>('AEPS_VIMO_PIPE') ?? '1';

    const providerPayload = {
      merchantRefId: payload.merchantRefId,

      merchantId: payload.merchantId,

      transactionType: 'CD',

      aadhaarNumber: payload.aadhaarNumber,

      mobileNumber: payload.mobileNumber,

      amount: payload.amount,

      bankIIN: payload.bankIIN,

      ipAddress: payload.ipAddress,

      pipe,

      lat: payload.lat,

      long: payload.long,

      deviceType: payload.deviceType,

      /*
       * CD ke liye AePS Txn OTP docs mein
       * required nahi diya gaya.
       */
      cwAuthTxnId: '',

      udf1: payload.udf1 ?? '',

      udf2: payload.udf2 ?? '',

      udf3: payload.udf3 ?? '',

      pidData: payload.pidData,
    };

    const encryptedBody = this.crypto.encryptRequestBody(providerPayload);

    const response = await this.authenticatedPost<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.AEPS_TRANSACTION,
      encryptedBody,
    );

    if (!response.data) {
      throw new BadGatewayException({
        message:
          response.message ||
          'VimoPay Cash Deposit response does not contain data',

        responseCode: response.responseCode,
      });
    }

    return this.crypto.decryptJson<VimopayCashDepositResponse>(response.data);
  }
}
