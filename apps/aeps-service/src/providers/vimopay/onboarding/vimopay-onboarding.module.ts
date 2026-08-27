import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../database/prisma.module';

import { AepsMerchantProfileModule } from '../../../merchant-profile/aeps-merchant-profile.module';

import { AepsIntegrationsModule } from '../../../integrations/aeps-integrations.module';

import { VimopayModule } from '../vimopay.module';

import { VimopayOnboardingService } from './vimopay-onboarding.service';

import { VimopayOnboardingDebugController } from './vimopay-onboarding-debug.controller';

@Module({
  imports: [
    PrismaModule,

    AepsMerchantProfileModule,

    AepsIntegrationsModule,

    VimopayModule,
  ],

  controllers: [VimopayOnboardingDebugController],

  providers: [VimopayOnboardingService],

  exports: [VimopayOnboardingService],
})
export class VimopayOnboardingModule {}
