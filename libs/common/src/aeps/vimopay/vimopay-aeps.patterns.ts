export const VIMOPAY_AEPS_PATTERNS = {
  /*
   * Master APIs
   */
  GET_BANKS: 'aeps.vimopay.master.banks',

  GET_STATES: 'aeps.vimopay.master.states',

  GET_DISTRICTS: 'aeps.vimopay.master.districts',

  GET_BANK_IINS: 'aeps.vimopay.master.bank-iins',

  /*
   * Merchant onboarding
   */
  GET_STATUS: 'aeps.vimopay.onboarding.status',

  REGISTER: 'aeps.vimopay.onboarding.register',

  SEND_OTP: 'aeps.vimopay.onboarding.otp.send',

  RESEND_OTP: 'aeps.vimopay.onboarding.otp.resend',

  VERIFY_OTP: 'aeps.vimopay.onboarding.otp.verify',

  EKYC: 'aeps.vimopay.onboarding.ekyc',

  TWO_FACTOR_AUTH: 'aeps.vimopay.onboarding.2fa',

  /*
   * TRANSACTIONS
   */
  BALANCE_ENQUIRY: 'aeps.vimopay.transaction.balance-enquiry',

  MINI_STATEMENT: 'aeps.vimopay.transaction.mini-statement',

  CASH_WITHDRAWAL_OTP: 'aeps.vimopay.transaction.cash-withdrawal.otp',

  CASH_WITHDRAWAL: 'aeps.vimopay.transaction.cash-withdrawal',

  AADHAAR_PAY_OTP: 'aeps.vimopay.transaction.aadhaar-pay.otp',

  AADHAAR_PAY: 'aeps.vimopay.transaction.aadhaar-pay',

  CASH_DEPOSIT: 'aeps.vimopay.transaction.cash-deposit',
} as const;
