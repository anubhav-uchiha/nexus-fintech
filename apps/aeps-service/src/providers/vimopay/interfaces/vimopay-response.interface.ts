export interface VimopayEncryptedResponse {
  successStatus: boolean;
  message: string;
  responseCode: string;
  data?: string | null;
}

export interface VimopayAuthorizeResult {
  success: boolean;
  responseCode: string;
  message: string;
  tokenReceived: boolean;
}

export interface VimopayBank {
  description: string;
  code: string;
}

export interface VimopayState {
  description: string;
  code: string;
}

export interface VimopayDistrict {
  code: string;
  description: string;
}

export interface VimopayBankIin {
  iin: string;
  description: string;
}

export interface VimopayMerchantRegistrationResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  merchantId: string;
  txnRefId: string;
  merchantRefId: string;

  firstName: string;
  middleName: string;
  lastName: string;

  emailId: string;
  mobileNo: string;

  aadhaarNo: string;
  panNo: string;

  pipe: string;
}

export interface VimopayMerchantOtpResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  merchantRefId: string;
  merchantId: string;
  txnRefId: string;

  pipe: string;
}

export interface VimopayMerchantEkycResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  merchantRefId: string;
  merchantId: string;
  txnRefId: string;

  pipe: string;
}

export interface VimopayTwoFactorAuthResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  merchantRefId: string;
  merchantId: string;
  txnRefId: string;

  pipe: string;
  lat: string;
  long: string;
}

export interface VimopayBalanceEnquiryResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  txnRefId: string;
  merchantRefId: string;

  transactionAmount: string;
  aadhaarNo: string;
  txnDateTime: string;

  bankIIN: string;
  rrn: string;

  npciCode: string;
  npciMessage: string;

  availableBalance: string;

  pipe: string;
  lat?: string;
  long?: string;

  udf1?: string;
  udf2?: string;
  udf3?: string;
}

export interface VimopayMiniStatementResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  txnRefId: string;
  merchantRefId: string;

  transactionAmount: string;

  transactionList: string;

  aadhaarNo: string;
  txnDateTime: string;

  bankIIN: string;
  rrn: string;

  npciCode: string;
  npciMessage: string;

  availableBalance: string;

  pipe: string;

  lat?: string;
  long?: string;

  udf1?: string;
  udf2?: string;
  udf3?: string;
}

export interface VimopayCashWithdrawalResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  txnRefId: string;
  merchantRefId: string;

  transactionAmount: string;

  aadhaarNo: string;
  txnDateTime: string;

  bankIIN: string;
  rrn: string;

  npciCode: string;
  npciMessage: string;

  availableBalance: string;

  pipe: string;

  lat?: string;
  long?: string;

  udf1?: string;
  udf2?: string;
  udf3?: string;
}

export interface VimopayAepsTransactionOtpResponse {
  npciCode: string;
  npciMessage: string;

  status: string;
  statusDescription: string;

  txnDateTime: string;
  txnRefId: string;
}

export interface VimopayAadhaarPayResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  merchantId?: string;

  txnRefId: string;
  merchantRefId: string;

  transactionAmount: string;
  transactionList?: string;

  aadhaarNo: string;
  txnDateTime: string;

  bankIIN: string;
  rrn: string;

  npciCode: string;
  npciMessage: string;

  availableBalance?: string;

  pipe: string;

  udf1?: string;
  udf2?: string;
  udf3?: string;
}

export interface VimopayCashDepositResponse {
  status: string;
  merchantStatus: string;
  statusDescription: string;

  merchantId?: string;

  txnRefId: string;
  merchantRefId: string;

  transactionAmount: string;
  transactionList?: string;

  aadhaarNo: string;
  txnDateTime: string;

  bankIIN: string;
  rrn: string;

  npciCode: string;
  npciMessage: string;

  availableBalance?: string;

  pipe: string;

  lat?: string;
  long?: string;

  udf1?: string;
  udf2?: string;
  udf3?: string;
}
