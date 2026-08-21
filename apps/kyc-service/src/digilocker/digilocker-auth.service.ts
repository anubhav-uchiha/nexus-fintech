import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';

import { DigiLockerSessionService } from './digilocker-session.service';

@Injectable()
export class DigiLockerAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: DigiLockerSessionService,
  ) {}

  async initiateAuthorization(identityId: string) {
    const authorizationEndpoint = this.getRequiredConfig(
      'DIGILOCKER_AUTHORIZATION_URL',
    );

    const clientId = this.getRequiredConfig('DIGILOCKER_CLIENT_ID');

    const redirectUri = this.getRequiredConfig('DIGILOCKER_REDIRECT_URI');

    const requestedScopes = this.getRequestedScopes();

    const authorizationSession =
      await this.sessionService.createAuthorizationSession(
        identityId,
        requestedScopes,
      );

    const authorizationUrl = new URL(authorizationEndpoint);

    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', clientId);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('state', authorizationSession.state);
    authorizationUrl.searchParams.set(
      'code_challenge',
      authorizationSession.codeChallenge,
    );
    authorizationUrl.searchParams.set(
      'code_challenge_method',
      authorizationSession.codeChallengeMethod,
    );

    if (requestedScopes.length > 0) {
      authorizationUrl.searchParams.set('scope', requestedScopes.join(' '));
    }

    return {
      success: true,
      sessionId: authorizationSession.sessionId,
      authorizationUrl: authorizationUrl.toString(),
      expiresAt: authorizationSession.expiresAt,
    };
  }

  private getRequestedScopes(): string[] {
    const configuredScopes =
      this.configService.get<string>('DIGILOCKER_SCOPES') ?? '';

    return configuredScopes
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new RpcException({
        statusCode: 503,
        message: `${key} is not configured`,
      });
    }

    return value;
  }
}
