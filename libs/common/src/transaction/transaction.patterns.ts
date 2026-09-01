export const TRANSACTION_PATTERNS = {
  CREATE: 'transaction.create',
  GET_BY_REFERENCE: 'transaction.get-by-reference',
  GET_BALANCE: 'transaction.get-balance',
  TRANSFER: 'transaction.transfer',
  CREATE_COMMISSION: 'transaction.create-commission',

  /*
   * Provider transaction tracking
   */
  CREATE_PROVIDER_TRANSACTION: 'transaction.provider.create',

  FINALIZE_PROVIDER_TRANSACTION: 'transaction.provider.finalize',

  MARK_PROVIDER_TRANSACTION_UNKNOWN: 'transaction.provider.mark-unknown',

  GET_PROVIDER_TRANSACTION: 'transaction.provider.get-by-reference',
  MARK_PROVIDER_TRANSACTION_PROCESSING: 'transaction.provider.mark-processing',

  LIST_PROVIDER_TRANSACTIONS: 'transaction.provider.list',
  LIST_RECONCILIATION_QUEUE: 'transaction.provider.reconciliation.list',

  RESOLVE_PROVIDER_TRANSACTION: 'transaction.provider.reconciliation.resolve',
  REQUEST_PROVIDER_TRANSACTION_REVERSAL:
    'transaction.provider.reversal.request',

  START_PROVIDER_TRANSACTION_REVERSAL: 'transaction.provider.reversal.start',

  COMPLETE_PROVIDER_TRANSACTION_REVERSAL:
    'transaction.provider.reversal.complete',

  FAIL_PROVIDER_TRANSACTION_REVERSAL: 'transaction.provider.reversal.fail',
  POST_PROVIDER_WALLET_ENTRY: 'transaction.provider.wallet.post-entry',

  PREPARE_PROVIDER_WALLET_DEBIT: 'transaction.provider.wallet.prepare-debit',

  CONFIRM_PROVIDER_WALLET_RESERVATION:
    'transaction.provider.wallet.confirm-reservation',
  UPDATE_PROVIDER_COMMISSION_STATE:
    'transaction.provider.commission.update-state',
} as const;
