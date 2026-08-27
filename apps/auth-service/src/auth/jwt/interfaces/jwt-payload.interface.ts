export interface JwtPayload {
  sub: string;
  sid: string;
  loginId: string;
  username: string;
  email: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
}
