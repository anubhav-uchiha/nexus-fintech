import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { SuperAdminRepository } from './repository/super-admin.repository';
import { SuperAdminSessionService } from './super-admin-session.service';
import { PasswordModule } from '../auth/password/password.module';
import { JwtModule } from '../auth/jwt/jwt.module';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminAuthKafkaController } from './super-admin-auth.kafka.controller';
import { OtpModule } from '../otp/otp.module';
import { IdentityModule } from '../identity/identity.module';
import { RoleModule } from '../role/role.module';
import { DeviceModule } from '../auth/device/device.module';

@Module({
  imports: [
    PrismaModule,
    PasswordModule,
    JwtModule,
    OtpModule,
    IdentityModule,
    RoleModule,
    DeviceModule,
  ],
  controllers: [SuperAdminAuthKafkaController],
  providers: [
    SuperAdminRepository,
    SuperAdminSessionService,
    SuperAdminAuthService,
  ],
  exports: [
    SuperAdminRepository,
    SuperAdminSessionService,
    SuperAdminAuthService,
  ],
})
export class SuperAdminModule {}
