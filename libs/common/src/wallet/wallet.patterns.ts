export const WALLET_PATTERNS = {
  GET_BALANCES: 'wallet.get-balances',
  ADD_MONEY: 'wallet.add-money',
  TRANSFER: 'wallet.transfer',
  CALCULATE_COMMISSION: 'wallet.calculate-commission',
  SETTLE_AEPS_PRINCIPAL: 'wallet.aeps.settle-principal',
  PREPARE_AEPS_CASH_DEPOSIT: 'wallet.aeps.cash-deposit.prepare',

  CONFIRM_AEPS_CASH_DEPOSIT: 'wallet.aeps.cash-deposit.confirm',

  COMPENSATE_AEPS_CASH_DEPOSIT: 'wallet.aeps.cash-deposit.compensate',
  CREDIT_AEPS_COMMISSION: 'wallet.aeps.commission.credit',
  CREDIT_COMMISSION_DISTRIBUTION: 'wallet.commission.distribution.credit',
} as const;
