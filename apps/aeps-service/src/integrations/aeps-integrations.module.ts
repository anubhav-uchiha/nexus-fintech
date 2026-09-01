import { Module } from '@nestjs/common';

import { ClientsModule, Transport } from '@nestjs/microservices';

import { ConfigService } from '@nestjs/config';

import { AepsBankService, AEPS_BANK_CLIENT } from './bank/aeps-bank.service';

import { AepsKycService, AEPS_KYC_CLIENT } from './kyc/aeps-kyc.service';
import {
  AepsProviderTransactionService,
  AEPS_TRANSACTION_CLIENT,
} from './transaction/aeps-provider-transaction.service';
import {
  AepsWalletService,
  AEPS_WALLET_CLIENT,
} from './wallet/aeps-wallet.service';
import {
  AepsCommissionService,
  AEPS_COMMISSION_CLIENT,
} from './commission/aeps-commission.service';

function getKafkaBrokers(config: ConfigService): string[] {
  const brokerConfig =
    config.get<string>('KAFKA_BROKERS') ??
    config.get<string>('KAFKA_BROKER') ??
    'localhost:9092';

  return brokerConfig
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
}

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: AEPS_BANK_CLIENT,

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'aeps-bank-client',

              brokers: getKafkaBrokers(config),
            },

            consumer: {
              groupId: 'aeps-bank-client-group',
            },
          },
        }),
      },

      {
        name: AEPS_KYC_CLIENT,

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'aeps-kyc-client',

              brokers: getKafkaBrokers(config),
            },

            consumer: {
              groupId: 'aeps-kyc-client-group',
            },
          },
        }),
      },

      {
        name: AEPS_TRANSACTION_CLIENT,

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'aeps-transaction-client',

              brokers: getKafkaBrokers(config),
            },

            consumer: {
              groupId: 'aeps-transaction-client-group',
            },
          },
        }),
      },
      {
        name: AEPS_WALLET_CLIENT,

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'aeps-wallet-client',

              brokers: getKafkaBrokers(config),
            },

            consumer: {
              groupId: 'aeps-wallet-client-group',
            },
          },
        }),
      },
      {
        name: AEPS_COMMISSION_CLIENT,

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'aeps-commission-client',

              brokers: getKafkaBrokers(config),
            },

            consumer: {
              groupId: 'aeps-commission-client-group',
            },
          },
        }),
      },
    ]),
  ],

  providers: [
    AepsBankService,
    AepsKycService,
    AepsProviderTransactionService,
    AepsWalletService,
    AepsCommissionService,
  ],

  exports: [
    AepsBankService,
    AepsKycService,
    AepsProviderTransactionService,
    AepsWalletService,
    AepsCommissionService,
  ],
})
export class AepsIntegrationsModule {}
