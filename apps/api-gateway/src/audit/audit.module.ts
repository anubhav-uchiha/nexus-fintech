import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuditPublisherService } from './audit-publisher.service';
import { AuditMiddleware } from './audit.middleware';
import { AuditController } from './audit.controller';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUDIT_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const brokers = (
            config.get<string>('KAFKA_BROKERS') ??
            config.get<string>('KAFKA_BROKER') ??
            'localhost: 9092'
          )
            .split(',')
            .map((broker) => broker.trim())
            .filter(Boolean);

          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: `${config.get<string>('KAFKA_CLIENT_ID') ?? 'api-gateway'}-audit`,
                brokers,
              },
              consumer: {
                groupId:
                  config.get<string>('AUDIT_KAFKA_GROUP_ID') ??
                  'api-gateway-audit-group',
              },
            },
          };
        },
      },
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditPublisherService, AuditMiddleware],
  exports: [AuditPublisherService, AuditMiddleware],
})
export class AuditModule {}
