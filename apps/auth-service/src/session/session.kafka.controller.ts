import { Controller, UnauthorizedException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';
import { SessionService } from './session.service';

@Controller()
export class SessionKafkaController {
  constructor(private readonly sessionService: SessionService) {}

  @MessagePattern(AUTH_PATTERNS.GET_SESSIONS)
  getSessions(
    @Payload()
    payload: {
      identityId: string;
      currentSessionId: string;
    },
  ) {
    return this.sessionService.getUserSessions(
      payload.identityId,
      payload.currentSessionId,
    );
  }

  @MessagePattern(AUTH_PATTERNS.GET_SESSION)
  getSession(
    @Payload()
    payload: {
      identityId: string;
      sessionId: string;
      currentSessionId: string;
    },
  ) {
    return this.sessionService.getUserSessionById(
      payload.identityId,
      payload.sessionId,
      payload.currentSessionId,
    );
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_SESSION)
  revokeSession(
    @Payload()
    payload: {
      identityId: string;
      sessionId: string;
      currentSessionId: string;
    },
  ) {
    return this.sessionService.revokeUserSession(
      payload.identityId,
      payload.sessionId,
      payload.currentSessionId,
    );
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_OTHER_SESSIONS)
  revokeOtherSessions(
    @Payload()
    payload: {
      identityId: string;
      currentSessionId: string;
    },
  ) {
    if (!payload.currentSessionId) {
      throw new UnauthorizedException('Current session ID is missing');
    }

    return this.sessionService.revokeOtherSessions(
      payload.identityId,
      payload.currentSessionId,
    );
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_ALL_SESSIONS)
  revokeAllSessions(
    @Payload()
    payload: {
      identityId: string;
    },
  ) {
    return this.sessionService.revokeAllUserSessions(payload.identityId);
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_SESSION)
  validateSession(
    @Payload()
    payload: {
      identityId: string;
      sessionId: string;
    },
  ) {
    return this.sessionService.validateSession(
      payload.identityId,
      payload.sessionId,
    );
  }
}
