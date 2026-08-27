import { Module } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { ClientsModule, Transport } from '@nestjs/microservices';

import {
  AEPS_SERVICE_CLIENT,
  VimopayAepsService,
} from './vimopay-aeps.service';

import { VimopayAepsController } from './vimopay-aeps.controller';

function resolveBrokers(configService: ConfigService): string[] {
  const configured =
    configService.get<string[] | string>('kafka.brokers') ??
    process.env.KAFKA_BROKERS ??
    'localhost:9092';

  if (Array.isArray(configured)) {
    return configured;
  }

  return configured
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
}

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: AEPS_SERVICE_CLIENT,

        inject: [ConfigService],

        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'api-gateway-aeps',

              brokers: resolveBrokers(configService),
            },

            consumer: {
              groupId: 'api-gateway-aeps-consumer',
            },
          },
        }),
      },
    ]),
  ],

  controllers: [VimopayAepsController],

  providers: [VimopayAepsService],

  exports: [VimopayAepsService],
})
export class VimopayAepsModule {}
