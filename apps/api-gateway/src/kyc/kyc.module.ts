import { Module } from '@nestjs/common';
import { KycGatewayController } from './kyc.controller';
import { KycGatewayService } from './kyc.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from '../storage/s3/s3.module';
import { IdempotencyModule } from './idempotency/idempotency.module';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KYC_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-kyc-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'api-gateway-kyc-client',
            },
          },
        }),
      },
    ]),
    AuthModule,
    S3Module,
    IdempotencyModule,
  ],
  controllers: [KycGatewayController],
  providers: [KycGatewayService],
})
export class KycModule {}
