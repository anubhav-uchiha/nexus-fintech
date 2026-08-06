export const KAFKA_CLIENTS = {
  AUTH: 'AUTH_SERVICE',
  WALLET: 'WALLET_SERVICE',
  NOTIFICATION: 'NOTIFICATION_SERVICE',
  TRANSACTION: 'TRANSACTION_SERVICE',
  COMMISSION: 'COMMISSION_SERVICE',
} as const;

export const KAFKA_GROUP = {
  AUTH: 'auth-consumer-group',
  WALLET: 'wallet-consumer-group',
  NOTIFICATION: 'notification-consumer-group',
  TRANSACTION: 'transaction-consumer-group',
  COMMISSION: 'commission-consumer-group',
} as const;

export const KAFKA_RETY = {
  RETRIES: 5,
  INITIAL_RETRY_TIME: 300,
} as const;
