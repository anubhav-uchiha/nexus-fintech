import { Module } from '@nestjs/common';

import { ClientsModule, Transport } from '@nestjs/microservices';

import { ConfigService } from '@nestjs/config';

import { AepsBankService, AEPS_BANK_CLIENT } from './bank/aeps-bank.service';

import { AepsKycService, AEPS_KYC_CLIENT } from './kyc/aeps-kyc.service';

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
    ]),
  ],

  providers: [AepsBankService, AepsKycService],

  exports: [AepsBankService, AepsKycService],
})
export class AepsIntegrationsModule {}
