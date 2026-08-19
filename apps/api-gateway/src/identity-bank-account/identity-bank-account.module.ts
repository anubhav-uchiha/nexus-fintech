import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IdentityBankAccountController } from './identity-bank-account.controller';
import { IdentityBankAccountService } from './identity-bank-account.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'IDENTITY_BANK_ACCOUNT_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-identity-bank-account-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'api-gateway-identity-bank-account-client',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [IdentityBankAccountController],
  providers: [IdentityBankAccountService,JwtService],
})
export class IdentityBankAccountModule {}
