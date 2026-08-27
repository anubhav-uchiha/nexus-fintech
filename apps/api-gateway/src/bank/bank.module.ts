import { Module } from '@nestjs/common';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'BANK_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-bank-service-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'api-gateway-bank-service-client',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [BankController],
  providers: [BankService, RpcToHttpExceptionInterceptor],
})
export class BankModule {}
