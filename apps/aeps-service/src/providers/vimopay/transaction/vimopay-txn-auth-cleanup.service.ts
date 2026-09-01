import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  VimopayTxnAuthStatus,
  VimopayTxnAuthType,
} from '../../../../generated/prisma/enums';

import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class VimopayTxnAuthCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VimopayTxnAuthCleanupService.name);

  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,

    private readonly configService: ConfigService,
  ) {}

  /*
   * =====================================================
   * START PERIODIC CLEANUP
   * =====================================================
   */

  onModuleInit() {
    /*
     * Service start hote hi ek cleanup.
     */
    void this.cleanupExpiredAuthorizations();

    const configuredInterval = Number(
      this.configService.get('AEPS_VIMO_AUTH_CLEANUP_INTERVAL_MS') ?? 300000,
    );

    /*
     * Minimum 1 minute.
     */
    const intervalMs = Number.isFinite(configuredInterval)
      ? Math.max(configuredInterval, 60000)
      : 300000;

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredAuthorizations();
    }, intervalMs);

    /*
     * Timer process ko forcefully alive
     * nahi rakhega during shutdown.
     */
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /*
   * =====================================================
   * EXPIRE ALL STALE ISSUED AUTHORIZATIONS
   * =====================================================
   */

  async cleanupExpiredAuthorizations() {
    try {
      const result = await this.prisma.vimopayTxnAuthorization.updateMany({
        where: {
          status: VimopayTxnAuthStatus.ISSUED,

          expiresAt: {
            lt: new Date(),
          },
        },

        data: {
          status: VimopayTxnAuthStatus.EXPIRED,
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Expired ${result.count} stale VimoPay transaction authorization(s)`,
        );
      }

      return result.count;
    } catch (error) {
      this.logger.error(
        'Unable to cleanup expired VimoPay transaction authorizations',

        error instanceof Error ? error.stack : undefined,
      );

      return 0;
    }
  }

  /*
   * =====================================================
   * EXPIRE PREVIOUS ACTIVE AUTHORIZATIONS
   * =====================================================
   *
   * Example:
   *
   * User requests CW OTP
   * → AUTH-A issued
   *
   * Then user requests another CW OTP
   * → AUTH-B issued
   *
   * AUTH-A should no longer remain usable.
   */

  async expirePreviousIssued(profileId: string, type: VimopayTxnAuthType) {
    return this.prisma.vimopayTxnAuthorization.updateMany({
      where: {
        profileId,

        type,

        status: VimopayTxnAuthStatus.ISSUED,
      },

      data: {
        status: VimopayTxnAuthStatus.EXPIRED,
      },
    });
  }
}
