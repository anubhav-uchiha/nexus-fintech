import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommissionDistributionController } from './commission-distribution.controller';
import { CommissionDistributionService } from './commission-distribution.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'COMMISSION_DISTRIBUTION_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-commission-distribution-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'api-gateway-commission-distribution-client',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [CommissionDistributionController],
  providers: [CommissionDistributionService],
})
export class CommisisonDistributionModule {}
