import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { HttpToRpcExceptionInterceptor } from '../../common/interceptors/http-to-rpc-exception.interceptor';
import { AEPS_KAFKA_PATTERNS } from './constants/vimopay.constants';
import { VimopayService } from './vimopay.service';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class VimopayKafkaController {
  constructor(private readonly vimopayService: VimopayService) {}

  @MessagePattern(AEPS_KAFKA_PATTERNS.AUTHORIZE)
  async authorize() {
    return this.vimopayService.authorize();
  }
}
