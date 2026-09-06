import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

export type VimopayIncomeSource =
  'DUMMY_VIMOPAY_2_PERCENT' | 'VIMOPAY_WALLET' | 'VIMOPAY_MS';

export interface VimopayIncomeResult {
  available: boolean;

  amount: number | null;

  source: VimopayIncomeSource | null;

  ratePercentage: number | null;

  reason?: string;
}

type VimopayIncomeMode = 'UAT_SIMULATION' | 'PRODUCTION_WALLET';

@Injectable()
export class VimopayIncomeService {
  constructor(private readonly configService: ConfigService) {
    /*
     * =====================================================
     * STARTUP SAFETY VALIDATION
     * =====================================================
     *
     * Production environment mein dummy
     * provider income simulation kabhi
     * run nahi honi chahiye.
     *
     * Misconfiguration ho to service
     * startup par hi fail hogi.
     */

    const nodeEnv = this.getNodeEnvironment();

    const mode = this.getConfiguredMode();

    if (nodeEnv === 'production' && mode === 'UAT_SIMULATION') {
      throw new InternalServerErrorException(
        'AEPS_VIMOPAY_INCOME_MODE=UAT_SIMULATION is forbidden in production',
      );
    }
  }

  /*
   * =====================================================
   * NODE ENVIRONMENT
   * =====================================================
   */

  private getNodeEnvironment(): string {
    return String(this.configService.get('NODE_ENV') ?? '')
      .trim()
      .toLowerCase();
  }

  /*
   * =====================================================
   * RAW CONFIGURED MODE
   * =====================================================
   *
   * Invalid/missing value ko silently
   * default nahi karenge.
   *
   * Financial behavior explicit hona
   * mandatory hai.
   */

  private getConfiguredMode(): VimopayIncomeMode {
    const mode = String(
      this.configService.get('AEPS_VIMOPAY_INCOME_MODE') ?? '',
    )
      .trim()
      .toUpperCase();

    if (mode === 'UAT_SIMULATION') {
      return 'UAT_SIMULATION';
    }

    if (mode === 'PRODUCTION_WALLET') {
      return 'PRODUCTION_WALLET';
    }

    throw new InternalServerErrorException(
      'AEPS_VIMOPAY_INCOME_MODE must be UAT_SIMULATION or PRODUCTION_WALLET',
    );
  }

  /*
   * =====================================================
   * SAFE MODE RESOLUTION
   * =====================================================
   *
   * Constructor validation ke saath
   * runtime par bhi production protection
   * repeat kar rahe hain.
   *
   * Future mein ConfigService runtime
   * configuration source use kare to bhi
   * dummy income accidentally enable
   * nahi hogi.
   */

  private getMode(): VimopayIncomeMode {
    const mode = this.getConfiguredMode();

    const nodeEnv = this.getNodeEnvironment();

    if (nodeEnv === 'production' && mode === 'UAT_SIMULATION') {
      throw new InternalServerErrorException(
        'UAT provider-income simulation cannot run in production',
      );
    }

    return mode;
  }

  /*
   * =====================================================
   * RESOLVE PROVIDER INCOME
   * =====================================================
   */

  resolveForSuccessfulTransaction(
    transactionAmount: number,
  ): VimopayIncomeResult {
    /*
     * This resolver is only for
     * successful FINANCIAL transactions.
     */

    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      throw new BadRequestException(
        'Transaction amount must be greater than 0',
      );
    }

    const mode = this.getMode();

    /*
     * =====================================================
     * UAT SIMULATION
     * =====================================================
     *
     * Used only for hierarchy,
     * commission distribution and
     * wallet accounting testing.
     *
     * Formula:
     *
     * provider income =
     * exactly 2% of transaction amount
     *
     * Calculation paise level par
     * rounded hogi.
     */

    if (mode === 'UAT_SIMULATION') {
      const amountPaise = Math.round(transactionAmount * 100);

      const incomePaise = Math.round((amountPaise * 2) / 100);

      return {
        available: true,

        amount: incomePaise / 100,

        source: 'DUMMY_VIMOPAY_2_PERCENT',

        ratePercentage: 2,
      };
    }

    /*
     * =====================================================
     * PRODUCTION WALLET MODE
     * =====================================================
     *
     * IMPORTANT:
     *
     * Transaction success ke waqt
     * provider income assume nahi karenge.
     *
     * Actual VimoPay wallet / MS / ledger
     * integration later exact income
     * reconcile karegi.
     *
     * NEVER:
     *
     * transactionAmount * 2%
     *
     * in production.
     */

    return {
      available: false,

      amount: null,

      source: null,

      ratePercentage: null,

      reason: 'WAITING_FOR_VIMOPAY_WALLET_INCOME',
    };
  }
}
