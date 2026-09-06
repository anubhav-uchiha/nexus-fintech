import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { ClientsModule, Transport } from '@nestjs/microservices';

import { TransactionService } from './transaction.service';

import { TransactionKafkaController } from './transaction.kafka.controller';

import { TRANSACTION_COMMISSION_CLIENT } from './transaction.constants';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: TRANSACTION_COMMISSION_CLIENT,

        imports: [ConfigModule],

        inject: [ConfigService],

        useFactory: (configService: ConfigService) => {
          const kafkaConfigBrokers =
            configService.get<string[]>('kafka.brokers');

          const envBrokers = String(
            configService.get<string>('KAFKA_BROKERS') ??
              process.env.KAFKA_BROKERS ??
              '',
          )
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

          /*
           * Priority:
           *
           * 1. kafka.config brokers
           * 2. KAFKA_BROKERS env
           * 3. localhost fallback
           */
          const brokers =
            Array.isArray(kafkaConfigBrokers) && kafkaConfigBrokers.length > 0
              ? kafkaConfigBrokers
                  .map((item) => String(item).trim())
                  .filter(Boolean)
              : envBrokers.length > 0
                ? envBrokers
                : ['localhost:9092'];

          console.log('[TRANSACTION → COMMISSION KAFKA]', {
            brokers,
          });

          return {
            transport: Transport.KAFKA,

            options: {
              client: {
                clientId: 'transaction-service-commission-client',

                brokers,
              },

              consumer: {
                groupId: 'transaction-service-commission-client-group',
              },
            },
          };
        },
      },
    ]),
  ],

  controllers: [TransactionKafkaController],

  providers: [TransactionService],

  exports: [TransactionService],
})
export class TransactionModule {}
