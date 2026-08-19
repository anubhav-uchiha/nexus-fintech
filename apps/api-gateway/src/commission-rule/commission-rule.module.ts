import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommissionRuleController } from './commission-rule.controller';
import { CommissionRuleService } from './commission-rule.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'COMMISSION_RULE_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-commission-rule-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'api-gateway-commission-rule-client',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [CommissionRuleController],
  providers: [CommissionRuleService],
})
export class CommisisonRuleModule {}
