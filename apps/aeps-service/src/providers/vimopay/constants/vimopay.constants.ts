export const VIMOPAY_ENDPOINTS = {
  AUTHORIZE: '/aepsapi/api/signature/authorizeuat',

  BANK_LIST: '/masterapi/api/master/banklistuat',
  BANK_IIN_LIST: '/aepsapi/api/payment/bankiinuat',
  STATE_LIST: '/masterapi/api/master/statelistuat',
  DISTRICT_LIST: '/aepsapi/api/payment/acquiredistrictuat',

  MERCHANT_ONBOARD: '/aepsapi/api/payment/merchantonboarduat',

  SEND_OTP: '/aepsapi/api/payment/sendotpuat',
  RESEND_OTP: '/aepsapi/api/payment/resendotpuat',
  VALIDATE_OTP: '/aepsapi/api/payment/validateotpuat',

  MERCHANT_EKYC: '/aepsapi/api/payment/merchantekycuat',
  TWO_FACTOR_AUTH: '/aepsapi/api/payment/2fauat',

  AEPS_TRANSACTION_OTP: '/aepsapi/api/Payment/AepsTransactionOtpuat',

  AEPS_TRANSACTION: '/aepsapi/api/payment/aepsuat',
} as const;

export const VIMOPAY_TRANSACTION_CODES = {
  CASH_WITHDRAWAL: 'CW',
  BALANCE_ENQUIRY: 'BE',
  MINI_STATEMENT: 'MS',
  AADHAAR_PAY: 'AP',
  CASH_DEPOSIT: 'CD',
} as const;

export const VIMOPAY_AUTH_TYPES = {
  BIOMETRIC: 'BA',
  FACE: 'FA',
} as const;

export const VIMOPAY_DUAL_AUTH_TRANSACTION_CODES = {
  CASH_WITHDRAWAL: 'CWTFA',
  AADHAAR_PAY: 'APTFA',
} as const;

export const VIMOPAY_RESPONSE_CODES = {
  SUCCESS: '000',
  FAILED: '001',
  PENDING: '002',
  VALIDATION_FAILED: '003',
} as const;

export const AEPS_KAFKA_PATTERNS = {
  AUTHORIZE: 'aeps.vimopay.authorize',
} as const;
