import { Module } from '@nestjs/common';
import { TrustedDeviceService } from './trusted-device.service';

@Module({
  providers: [TrustedDeviceService],
  exports: [TrustedDeviceService],
})
export class DeviceModule {}
