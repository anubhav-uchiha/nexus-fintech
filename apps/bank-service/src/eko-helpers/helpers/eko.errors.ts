export type EkoErrorDefinition = {
  message: string;
  type: 'VALIDATION' | 'AUTHENTICATION' | 'ACCOUNT' | 'PROVIDER' | 'UNKNOWN';
  retryable: boolean;
};

export const EKO_BANK_ERRORS: Record<string, EkoErrorDefinition> = {
  '41': {
    message: 'Wrong IFSC',
    type: 'VALIDATION',
    retryable: false,
  },

  '44': {
    message: 'Incomplete IFSC code',
    type: 'VALIDATION',
    retryable: false,
  },

  '45': {
    message: 'Incomplete IFSC code',
    type: 'VALIDATION',
    retryable: false,
  },

  '48': {
    message: 'Recipient bank not found',
    type: 'ACCOUNT',
    retryable: false,
  },

  '102': {
    message: 'Invalid account number length',
    type: 'VALIDATION',
    retryable: false,
  },

  '136': {
    message: 'Invalid IFSC format',
    type: 'VALIDATION',
    retryable: false,
  },

  '508': {
    message: 'Invalid IFSC for the selected bank',
    type: 'VALIDATION',
    retryable: false,
  },

  '521': {
    message: 'IFSC not found in Eko system',
    type: 'VALIDATION',
    retryable: false,
  },

  '46': {
    message: 'Invalid account details',
    type: 'ACCOUNT',
    retryable: false,
  },

  '350': {
    message: 'Verification failed. Recipient name not found',
    type: 'ACCOUNT',
    retryable: false,
  },

  '55': {
    message: 'Error from NPCI',
    type: 'PROVIDER',
    retryable: true,
  },

  '544': {
    message: 'Transaction not processed. Bank is not available now',
    type: 'PROVIDER',
    retryable: true,
  },

  '347': {
    message: 'Insufficient balance',
    type: 'PROVIDER',
    retryable: false,
  },

  '460': {
    message: 'Invalid channel',
    type: 'AUTHENTICATION',
    retryable: false,
  },

  '319': {
    message: 'Invalid sender/initiator',
    type: 'AUTHENTICATION',
    retryable: false,
  },

  '314': {
    message: 'Monthly limit exceeded',
    type: 'PROVIDER',
    retryable: false,
  },

  '945': {
    message: 'Sender/beneficiary monthly limit exhausted',
    type: 'PROVIDER',
    retryable: false,
  },

  '344': {
    message: 'IMPS is not available in this bank',
    type: 'PROVIDER',
    retryable: true,
  },

  '53': {
    message: 'IMPS transaction not allowed',
    type: 'PROVIDER',
    retryable: false,
  },

  '317': {
    message: 'NEFT not allowed',
    type: 'PROVIDER',
    retryable: false,
  },

  '313': {
    message: 'Recipient registration not done',
    type: 'VALIDATION',
    retryable: false,
  },

  '168': {
    message: 'TID does not exist',
    type: 'PROVIDER',
    retryable: false,
  },
} as const;
