import { Module } from '@nestjs/common';
import { IdentityModule } from './identity/identity.module';
import { AuthModule } from './auth/auth.module';
import { RoleModule } from './role/role.module';
import { ConfigModule } from '@nestjs/config';
import { OtpModule } from './otp/otp.module';
import appConfig from '@nexus/config/configs/app.config';
import { PrismaModule } from './database/prisma.module';
import { authValidationSchema } from '@nexus/config/validation/auth.vaidation';
import { CacheModule } from 'libs/cache/src';
import { KafkaModule } from 'libs/kafka/src';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `apps/auth-service/.env.${process.env.NODE_ENV}`,
        'apps/auth-service/.env',
      ],
      load: [appConfig],
      validationSchema: authValidationSchema,
    }),
    CacheModule,
    PrismaModule,
    IdentityModule,
    RoleModule,
    AuthModule,
    OtpModule,
    KafkaModule,
    SessionModule,
  ],
  providers: [],
})
export class AuthServiceModule {}
