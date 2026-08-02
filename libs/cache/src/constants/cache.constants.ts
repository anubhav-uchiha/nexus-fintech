export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const DEFAULT_CACHE_TTL = 300; // 5 Minutes

export const CACHE_PREFIX = 'nexus';

export const CACHE_KEYS = {
  OTP_PHONE: (phone: string) => `otp:phone:${phone}`,
  OTP_EMAIL: (email: string) => `otp:email:${email}`,

  VERIFIED_PHONE: (phone: string) => `verified:phone:${phone}`,
  VERIFIED_EMAIL: (email: string) => `verified:email:${email}`,

  OTP_ATTEMPTS_PHONE: (phone: string) => `otp-attempts:phone:${phone}`,
  OTP_ATTEMPTS_EMAIL: (email: string) => `otp-attempts:email:${email}`,

  OTP_COOLDOWN_PHONE: (phone: string) => `otp-cooldown:phone:${phone}`,
  OTP_COOLDOWN_EMAIL: (email: string) => `otp-cooldown:email:${email}`,
};
