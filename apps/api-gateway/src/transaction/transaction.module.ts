import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransactionGatewayService } from './transaction.gateway.service';
import { TransactionController } from './transaction.controller';

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
    ]),
  ],

  controllers: [TransactionController],

  providers: [TransactionGatewayService],

  exports: [TransactionGatewayService],
})
export class TransactionModule {}
