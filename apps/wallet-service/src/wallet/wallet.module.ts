import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { WalletService } from './wallet.service';
import { WalletKafkaController } from './wallet.kafka.controller';

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
              clientId: 'wallet-service-transaction-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'wallet-service-transaction-client',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [WalletKafkaController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
