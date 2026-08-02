import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
// import { DatabaseModule } from '@nexus/database';

@Module({
  // imports: [DatabaseModule],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
