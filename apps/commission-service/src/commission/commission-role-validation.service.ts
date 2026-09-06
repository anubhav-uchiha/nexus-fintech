import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { ClientKafka, RpcException } from '@nestjs/microservices';

import { firstValueFrom, timeout } from 'rxjs';

import { ROLE_PATTERNS } from '@nexus/common/role';

export const COMMISSION_AUTH_CLIENT = 'COMMISSION_AUTH_CLIENT';
import { AUTH_PATTERNS } from '@nexus/common/auth';

interface RecipientEligibilityResponse {
  identityId: string;

  eligible: boolean;

  status?: string;

  role?: string;

  expectedRole?: string;

  reason:
    | 'IDENTITY_NOT_FOUND'
    | 'IDENTITY_NOT_ACTIVE'
    | 'ROLE_NOT_ACTIVE'
    | 'ROLE_MISMATCH'
    | null;
}

interface RecipientEligibilityResponse {
  identityId: string;

  eligible: boolean;

  status?: string;

  role?: string;

  expectedRole?: string;

  reason:
    | 'IDENTITY_NOT_FOUND'
    | 'IDENTITY_NOT_ACTIVE'
    | 'ROLE_NOT_ACTIVE'
    | 'ROLE_MISMATCH'
    | null;
}

interface AuthRoleResponse {
  id: string;

  name: string;

  prefix?: string;

  description?: string | null;

  isActive: boolean;
}

@Injectable()
export class CommissionRoleValidationService implements OnModuleInit {
  constructor(
    @Inject(COMMISSION_AUTH_CLIENT)
    private readonly authClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.authClient.subscribeToResponseOf(ROLE_PATTERNS.FIND_BY_NAME);
    this.authClient.subscribeToResponseOf(
      AUTH_PATTERNS.RESOLVE_COMMISSION_RECIPIENT_ELIGIBILITY,
    );

    await this.authClient.connect();
  }

  normalizeRole(role: string): string {
    return role.trim().toUpperCase().replace(/\s+/g, '_');
  }

  async assertActiveRole(roleName: string): Promise<AuthRoleResponse> {
    const normalizedRole = this.normalizeRole(roleName);

    if (!normalizedRole) {
      throw new RpcException({
        statusCode: 400,
        message: 'Recipient role is required',
      });
    }

    console.log('[COMMISSION AUTH] SENDING ROLE LOOKUP', normalizedRole);

    let role: AuthRoleResponse | null;

    try {
      role = await firstValueFrom(
        this.authClient
          .send<AuthRoleResponse | null>(ROLE_PATTERNS.FIND_BY_NAME, {
            name: normalizedRole,
          })
          .pipe(timeout(5000)),
      );

      console.log('[COMMISSION AUTH] ROLE LOOKUP RESPONSE', role);
    } catch (error: any) {
      console.error('[COMMISSION AUTH] ROLE LOOKUP FAILED', error);

      let payload = error?.error ?? error?.response ?? error;

      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          // keep string
        }
      }

      const isTimeout = error?.name === 'TimeoutError';

      throw new RpcException({
        statusCode: isTimeout
          ? 503
          : Number(payload?.statusCode ?? payload?.status) || 500,

        message: isTimeout
          ? 'Auth service role validation timed out'
          : (payload?.message ?? error?.message ?? 'Unable to validate role'),
      });
    }

    if (!role) {
      throw new RpcException({
        statusCode: 404,
        message: `Recipient role ${normalizedRole} does not exist`,
      });
    }

    if (!role.isActive) {
      throw new RpcException({
        statusCode: 409,
        message: `Recipient role ${normalizedRole} is inactive`,
      });
    }

    return role;
  }

  async getRecipientEligibility(
    identityId: string,
    expectedRole: string,
  ): Promise<RecipientEligibilityResponse> {
    if (!identityId?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Commission recipient identity ID is required',
      });
    }

    const role = this.normalizeRole(expectedRole);

    if (!role) {
      throw new RpcException({
        statusCode: 400,
        message: 'Commission recipient role is required',
      });
    }

    try {
      return await firstValueFrom(
        this.authClient
          .send<RecipientEligibilityResponse>(
            AUTH_PATTERNS.RESOLVE_COMMISSION_RECIPIENT_ELIGIBILITY,

            {
              identityId,
              expectedRole: role,
            },
          )
          .pipe(timeout(5000)),
      );
    } catch (error: any) {
      console.error('[COMMISSION AUTH] RECIPIENT ELIGIBILITY FAILED', error);

      let payload = error?.error ?? error?.response ?? error;

      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          // keep string
        }
      }

      const isTimeout = error?.name === 'TimeoutError';

      throw new RpcException({
        statusCode: isTimeout
          ? 503
          : Number(payload?.statusCode ?? payload?.status) || 503,

        message: isTimeout
          ? 'Auth service recipient eligibility check timed out'
          : (payload?.message ??
            error?.message ??
            'Unable to verify commission recipient eligibility'),
      });
    }
  }
}
