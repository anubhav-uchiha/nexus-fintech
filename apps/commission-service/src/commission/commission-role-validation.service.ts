import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { ClientKafka, RpcException } from '@nestjs/microservices';

import { firstValueFrom } from 'rxjs';

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

    let role: AuthRoleResponse | null;

    try {
      role = await firstValueFrom(
        this.authClient.send<AuthRoleResponse | null>(
          ROLE_PATTERNS.FIND_BY_NAME,

          {
            name: normalizedRole,
          },
        ),
      );
    } catch (error: any) {
      /*
       * Auth-service RPC error
       * preserve karne ki try.
       */

      let payload = error?.error ?? error;

      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          // keep original
        }
      }

      const statusCode = Number(payload?.statusCode ?? payload?.status) || 500;

      throw new RpcException({
        statusCode,

        message:
          payload?.message ?? error?.message ?? 'Unable to validate role',
      });
    }

    /*
     * Role master mein exist hi nahi.
     */
    if (!role) {
      throw new RpcException({
        statusCode: 404,

        message: `Recipient role ${normalizedRole} does not exist`,
      });
    }

    /*
     * Role exists but disabled.
     */
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
    const role = this.normalizeRole(expectedRole);

    try {
      return await firstValueFrom(
        this.authClient.send<RecipientEligibilityResponse>(
          AUTH_PATTERNS.RESOLVE_COMMISSION_RECIPIENT_ELIGIBILITY,

          {
            identityId,
            expectedRole: role,
          },
        ),
      );
    } catch (error: any) {
      /*
       * IMPORTANT:
       *
       * Auth service unavailable ko
       * "recipient inactive" maan kar skip
       * NAHI karna.
       *
       * Warna temporary auth outage mein
       * distributor ka commission retailer
       * ko galat chala jayega.
       */

      const payload = error?.error ?? error?.response ?? error;

      throw new RpcException({
        statusCode: Number(payload?.statusCode) || 503,

        message:
          payload?.message ??
          'Unable to verify commission recipient eligibility',
      });
    }
  }
}
