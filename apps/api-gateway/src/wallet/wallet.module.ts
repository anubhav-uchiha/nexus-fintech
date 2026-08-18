import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WalletGatewayController } from './wallet.controller';
import { WalletGatewayService } from './wallet.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'WALLET_SERVICE',

        imports: [ConfigModule],

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'api-gateway-wallet-client',

              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },

            consumer: {
              groupId: 'api-gateway-wallet-client',
            },
          },
        }),
      },
    ]),
  ],

  controllers: [WalletGatewayController],

  providers: [WalletGatewayService],
})
export class WalletModule {}
