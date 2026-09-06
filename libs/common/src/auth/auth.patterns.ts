export const AUTH_PATTERNS = {
  REGISTER_ROLE: 'auth.register.role',
  REGISTER_SEND_OTP: 'auth.register.send-otp',
  REGISTER_VERIFY_OTP: 'auth.register.verify-otp',
  REGISTER_PAN: 'auth.register.pan',
  REGISTER_DETAILS: 'auth.register.details',

  CHANGE_LOGIN_METHOD: 'auth.change-login-method',

  LOGIN: 'auth.login',

  VERIFY_DEVICE_LOGIN: 'auth.login.verify-device',

  CHANGE_PASSWORD: 'auth.change-password',
  CHANGE_MPIN: 'auth.change-mpin',

  FORGOT_PASSWORD_VERIFY_USER: 'auth.forgot-password.verify-user',
  FORGOT_PASSWORD_VERIFY_OTP: 'auth.forgot-password.verify-otp',
  FORGOT_PASSWORD_RESET: 'auth.forgot-password.reset',

  SEND_PHONE_OTP: 'auth.send-phone-otp',
  SEND_EMAIL_OTP: 'auth.send-email-otp',

  VERIFY_PHONE_OTP: 'auth.verify-phone-otp',
  VERIFY_EMAIL_OTP: 'auth.verify-email-otp',

  REFRESH_TOKEN: 'auth.refresh-token',

  RESOLVE_ROLE_PERMISSIONS: 'authorization.resolve-role-permissions',

  RESOLVE_NOTIFICATION_RECIPIENT: 'auth.notification.resolve-recipient',

  RESOLVE_IDENTITY_PERMISSIONS: 'authorization.resolve-identity-permissions',

  LOGOUT: 'auth.logout',

  GET_SESSIONS: 'auth.sessions.list',
  GET_SESSION: 'auth.sessions.get',
  REVOKE_SESSION: 'auth.sessions.revoke',
  REVOKE_OTHER_SESSIONS: 'auth.sessions.revoke-others',
  REVOKE_ALL_SESSIONS: 'auth.sessions.revoke-all',
  VALIDATE_SESSION: 'auth.sessions.validate',

  RESOLVE_PEER_TRANSFER_PARTICIPANTS: 'auth.peer-transfer.resolve-participants',

  CACHE_TEST: 'auth.cache-test',

  RESOLVE_COMMISSION_RECIPIENT_ELIGIBILITY:
    'auth.commission-recipient.resolve-eligibility',

  SUPER_ADMIN_LOGIN: 'auth.super-admin.login',
  SUPER_ADMIN_REFRESH_TOKEN: 'auth.super-admin.refresh-token',
  SUPER_ADMIN_LOGOUT: 'auth.super-admin.logout',
  SUPER_ADMIN_VALIDATE_SESSION: 'auth.super-admin.sessions.validate',
  SUPER_ADMIN_ONBOARDING_SEND_PHONE_OTP:
    'auth.super-admin.onboarding.phone.send-otp',

  SUPER_ADMIN_ONBOARDING_VERIFY_PHONE_OTP:
    'auth.super-admin.onboarding.phone.verify-otp',
  SUPER_ADMIN_ONBOARDING_ADD_PAN: 'auth.super-admin.onboarding.pan.add',
  SUPER_ADMIN_CHANGE_PASSWORD: 'auth.super-admin.onboarding.change-password',

  SUPER_ADMIN_CHANGE_MPIN: 'auth.super-admin.onboarding.change-mpin',

  SUPER_ADMIN_CREATE_IDENTITY_ACCOUNT:
    'auth.super-admin.accounts.create-identity',

  SUPER_ADMIN_VERIFY_DEVICE_LOGIN: 'auth.super-admin.login.verify-device',

  IDENTITY_ONBOARDING_SEND_PHONE_OTP: 'auth.identity.onboarding.phone.send-otp',

  IDENTITY_ONBOARDING_VERIFY_PHONE_OTP:
    'auth.identity.onboarding.phone.verify-otp',
  IDENTITY_ONBOARDING_ADD_PAN: 'auth.identity.onboarding.pan.add',
  CREATE_IDENTITY_ACCOUNT: 'auth.identity-account.create',
} as const;
