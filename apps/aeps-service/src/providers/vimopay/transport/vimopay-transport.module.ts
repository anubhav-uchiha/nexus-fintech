import { Module } from '@nestjs/common';

import { HttpToRpcExceptionInterceptor } from '../../../common/interceptors/http-to-rpc-exception.interceptor';

import { VimopayModule } from '../vimopay.module';

import { VimopayOnboardingModule } from '../onboarding/vimopay-onboarding.module';

import { VimopayKafkaController } from './vimopay-kafka.controller';
import { VimopayTransactionModule } from '../transaction/vimopay-transaction.module';

@Module({
  imports: [VimopayModule, VimopayOnboardingModule, VimopayTransactionModule],

  controllers: [VimopayKafkaController],

  providers: [HttpToRpcExceptionInterceptor],
})
export class VimopayTransportModule {}
