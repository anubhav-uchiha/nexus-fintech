import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthGatewayService } from './auth.gateway.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'api-gateway',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId:
                config.get<string>('KAFKA_GROUP_ID') ?? 'api-gateway-consumer',
            },
          },
        }),
      },
    ]),
  ],

  controllers: [AuthController],

  providers: [AuthGatewayService],

  exports: [AuthGatewayService],
})
export class AuthModule {}
