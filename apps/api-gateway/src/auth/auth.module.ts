import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthGatewayService } from './auth.gateway.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth-guard';
import { PermissionGuard } from './guards/permission.guard';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SuperAdminAuthGuard } from './guards/super-admin-auth.guard';
import { SuperAdminOnboardingGuard } from './guards/super-admin-onboarding.guard';

@Global()
@Module({
  imports: [
    PassportModule,
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],

  controllers: [AuthController, SuperAdminAuthController],

  providers: [
    AuthGatewayService,
    JwtAuthGuard,
    PermissionGuard,
    SuperAdminAuthGuard,
    SuperAdminOnboardingGuard,
  ],

  exports: [
    AuthGatewayService,
    JwtModule,
    JwtAuthGuard,
    PermissionGuard,
    SuperAdminAuthGuard,
    SuperAdminOnboardingGuard,
  ],
})
export class AuthModule {}
