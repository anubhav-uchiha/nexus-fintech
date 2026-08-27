export const BANK_ACCOUNT_PATTERNS = {
  CREATE_BANK_ACCOUNT: 'bank.create',
  GET_MY_BANK_ACCOUNTS: 'bank.get.me',
  GET_MY_BANK_ACCOUNT: 'bank.get',
  GET_PRIMARY_BANK_ACCOUNT: 'bank.get-primary',
  UPDATE_MY_BANK_ACCOUNT: 'bank.update-details',
  UPDATE_BANK_ACCOUNT_STATUS: 'bank.update-status',
  SET_BANK_ACCOUNT_AS_PRIMARY: 'bank.set-primary',
  // GET_DOCUMENTS: 'bank.get-documents',
  // UPLOAD_DOCUMENT: 'bank.upload-document',
  DELETE_MY_BANK_ACCOUNT: 'bank.delete',
  GET_BANK_LIST: 'bank.get-list',
  PROVIDE_DECRYPTED_BANK_ACCOUNT: 'bank-account.provide-decrypted-bank-account',
} as const;
