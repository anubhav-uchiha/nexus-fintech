import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AdminGatewayService } from './admin.gateway.service';
import { AdminController } from './admin.controller';
import { AccountController } from './account.controller';

@Module({
  imports: [
    ConfigModule,
    AuthModule,

    ClientsModule.registerAsync([
      {
        name: 'ADMIN_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-admin-client',
              brokers: [config.get<string>('KAFKA_BROKER') ?? 'localhost:9092'],
            },
            consumer: {
              groupId: 'api-gateway-admin-client-group',
            },
          },
        }),
      },
    ]),
  ],
  controllers: [AdminController, AccountController],
  providers: [AdminGatewayService],
  exports: [AdminGatewayService],
})
export class AdminModule {}
