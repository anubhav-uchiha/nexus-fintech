import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommissionHierarchyController } from './commission-hierarchy.controller';
import { CommissionHierarchyService } from './commission-hierarchy.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'COMMISSION_HIERARCHY_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-commission-hierarchy-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'api-gateway-commission-hierarchy-client',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [CommissionHierarchyController],
  providers: [CommissionHierarchyService],
})
export class CommisisonHierarchyModule {}
