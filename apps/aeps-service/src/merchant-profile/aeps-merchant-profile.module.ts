import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { AepsMerchantProfileService } from './aeps-merchant-profile.service';

@Module({
  imports: [PrismaModule],
  providers: [AepsMerchantProfileService],
  exports: [AepsMerchantProfileService],
})
export class AepsMerchantProfileModule {}
