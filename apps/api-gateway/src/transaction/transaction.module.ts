import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TransactionGatewayService } from './transaction.gateway.service';
import { TransactionController } from './transaction.controller';
import { ProviderTransactionController } from './provider-transaction.controller';
import { ProviderTransactionAdminController } from './provider-transaction-admin.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'TRANSACTION_SERVICE',

        imports: [ConfigModule],

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'api-gateway-transaction-client',

              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },

            consumer: {
              groupId: 'api-gateway-transaction-client',
            },
          },
        }),
      },

      /*
       * Used only for transaction-admin
       * operations which must call AEPS:
       *
       * - provider income reconcile
       * - idempotency reconciliation sync
       */
      {
        name: 'TRANSACTION_AEPS_SERVICE',

        imports: [ConfigModule],

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'api-gateway-transaction-aeps-client',

              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },

            consumer: {
              /*
               * Request/reply client ke liye
               * unique group.
               */
              groupId: 'api-gateway-transaction-aeps-client',
            },
          },
        }),
      },
    ]),
  ],

  controllers: [
    TransactionController,

    /*
     * Retailer/frontend APIs.
     */
    ProviderTransactionController,

    /*
     * Admin APIs.
     */
    ProviderTransactionAdminController,
  ],

  providers: [TransactionGatewayService],

  exports: [TransactionGatewayService],
})
export class TransactionModule {}
