import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
// import { DatabaseModule } from '@nexus/database';
import { OtpRepository } from './repository/otp.repository';
import { IdentityModule } from '../identity/identity.module';
import { BullMQModule } from 'libs/queue/src/bullmq/bullmq.module';
import { OtpProcessor } from 'libs/queue/src/bullmq/processors/otp.processor';

@Module({
  imports: [
    // DatabaseModule,
    IdentityModule,
    BullMQModule,
  ],
  providers: [OtpService, OtpRepository, OtpProcessor],
  exports: [OtpService],
})
export class OtpModule {}
