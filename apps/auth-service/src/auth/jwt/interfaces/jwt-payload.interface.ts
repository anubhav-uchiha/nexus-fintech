export type AuthAccountType = 'IDENTITY' | 'SUPER_ADMIN';

export interface JwtPayload {
  sub: string;
  sid: string;
  accountType: AuthAccountType;
  loginId: string;
  username: string;
  email: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
}
