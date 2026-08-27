import { Module } from '@nestjs/common';

import { HttpToRpcExceptionInterceptor } from '../../common/interceptors/http-to-rpc-exception.interceptor';

import { VimopayDebugController } from './vimopay-debug.controller';

import { VimopayAuthService } from './vimopay-auth.service';

import { VimopayClientService } from './vimopay-client.service';

import { VimopayCryptoService } from './vimopay-crypto.service';

import { VimopayService } from './vimopay.service';

@Module({
  controllers: [VimopayDebugController],

  providers: [
    HttpToRpcExceptionInterceptor,

    VimopayClientService,

    VimopayCryptoService,

    VimopayAuthService,

    VimopayService,
  ],

  exports: [
    VimopayClientService,

    VimopayCryptoService,

    VimopayAuthService,

    VimopayService,
  ],
})
export class VimopayModule {}
