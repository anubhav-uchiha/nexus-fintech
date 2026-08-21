import { Controller, UseInterceptors } from '@nestjs/common';
import { EkoService } from './eko.service';
import { AEPS_PATTERNS } from '@nexus/common/aeps/aeps.patterns';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HttpToRpcExceptionInterceptor } from '../../common/interceptors/http-to-rpc-exception.interceptor';
import { OnboardEkoMerchantCommandDto } from '@nexus/common/aeps/dto/onboard-eko-merchant-command.dto';

@Controller()
@UseInterceptors(HttpToRpcExceptionInterceptor)
export class EkoKafkaController {
  constructor(private readonly ekoService: EkoService) {}

  @MessagePattern(AEPS_PATTERNS.GET_ALL_SERVICES)
  async getAllServices() {
    return await this.ekoService.getAllServices();
  }
  @MessagePattern(AEPS_PATTERNS.ONBOARD_USER)
  onboardUser(@Payload() dto: OnboardEkoMerchantCommandDto) {
    return this.ekoService.onboardUser(dto);
  }
}
