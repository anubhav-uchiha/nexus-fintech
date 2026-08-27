export const RATE_LIMIT_PROFILE_KEY = 'rate_limit_profile';
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';
export const RATE_LIMIT_PROFILES = {
  DEFAULT: {
    maxRequests: 300,
    windowSeconds: 60,
    maxRequestsEnv: 'API_RATE_LIMIT_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_WINDOW_SECONDS',
  },

  LOGIN: {
    maxRequests: 20,
    windowSeconds: 60,
    maxRequestsEnv: 'API_RATE_LIMIT_LOGIN_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_LOGIN_WINDOW_SECONDS',
  },

  REGISTRATION: {
    maxRequests: 10,
    windowSeconds: 600,
    maxRequestsEnv: 'API_RATE_LIMIT_REGISTRATION_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_REGISTRATION_WINDOW_SECONDS',
  },

  OTP_SEND: {
    maxRequests: 10,
    windowSeconds: 60,
    maxRequestsEnv: 'API_RATE_LIMIT_OTP_SEND_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_OTP_SEND_WINDOW_SECONDS',
  },

  OTP_VERIFY: {
    maxRequests: 15,
    windowSeconds: 60,
    maxRequestsEnv: 'API_RATE_LIMIT_OTP_VERIFY_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_OTP_VERIFY_WINDOW_SECONDS',
  },

  PASSWORD_RECOVERY: {
    maxRequests: 10,
    windowSeconds: 900,
    maxRequestsEnv: 'API_RATE_LIMIT_RECOVERY_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_RECOVERY_WINDOW_SECONDS',
  },
  CREDENTIAL_CHANGE: {
    maxRequests: 10,
    windowSeconds: 900,
    maxRequestsEnv: 'API_RATE_LIMIT_CREDENTIAL_CHANGE_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_CREDENTIAL_CHANGE_WINDOW_SECONDS',
  },

  REFRESH: {
    maxRequests: 20,
    windowSeconds: 60,
    maxRequestsEnv: 'API_RATE_LIMIT_REFRESH_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_REFRESH_WINDOW_SECONDS',
  },
  SESSION_MANAGEMENT: {
    maxRequests: 20,
    windowSeconds: 60,
    maxRequestsEnv: 'API_RATE_LIMIT_SESSION_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_SESSION_WINDOW_SECONDS',
  },

  FINANCIAL_WRITE: {
    maxRequests: 30,
    windowSeconds: 60,
    maxRequestsEnv: 'API_RATE_LIMIT_FINANCIAL_MAX_REQUESTS',
    windowSecondsEnv: 'API_RATE_LIMIT_FINANCIAL_WINDOW_SECONDS',
  },
} as const;

export type RateLimitProfileName = keyof typeof RATE_LIMIT_PROFILES;
