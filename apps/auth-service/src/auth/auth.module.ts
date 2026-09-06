import { Module } from '@nestjs/common';
// import { DatabaseModule } from '@nexus/database';
import { IdentityModule } from '../identity/identity.module';
import { AuthService } from './auth.service';
import { PasswordModule } from './password/password.module';
import { RoleModule } from '../role/role.module';
import { JwtModule } from './jwt/jwt.module';
import { OtpModule } from '../otp/otp.module';
import { AuthKafkaController } from './auth.kafka.controller';
import { SessionModule } from '../session/session.module';
import { DeviceModule } from './device/device.module';

@Module({
  imports: [
    // DatabaseModule,
    IdentityModule,
    RoleModule,
    PasswordModule,
    JwtModule,
    OtpModule,
    SessionModule,
    DeviceModule,
  ],
  controllers: [AuthKafkaController],
  providers: [AuthService],
})
export class AuthModule {}
