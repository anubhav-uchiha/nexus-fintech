import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';

import { OtpRepository } from './repository/otp.repository';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  providers: [OtpService, OtpRepository],
  exports: [OtpService],
})
export class OtpModule {}
