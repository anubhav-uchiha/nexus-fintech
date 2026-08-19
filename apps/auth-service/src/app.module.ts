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
import authConfig from '@nexus/config/configs/auth.config';
import kafkaConfig from '@nexus/config/configs/kafka.config';
import redisConfig from '@nexus/config/configs/redis.config';
import { PermissionModule } from './permission/permission.module';
import { PackageModule } from './package/package.module';
import { PackagePermissionModule } from './package-permission/package-permission.module';
import { RolePackageModule } from './role-package/role-package.module';
import { RoleRegisterPermissionModule } from './role-register-permission/role-register-permission.module';
import { AuthorizationModule } from './authorization/authorization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `apps/auth-service/.env.${process.env.NODE_ENV}`,
        'apps/auth-service/.env',
      ],
      load: [appConfig, authConfig, kafkaConfig, redisConfig],
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
    PermissionModule,
    PackageModule,
    PackagePermissionModule,
    RolePackageModule,
    RoleRegisterPermissionModule,
    AuthorizationModule,
  ],
  providers: [],
  controllers: [],
})
export class AuthServiceModule {}
