import { Controller } from '@nestjs/common';
import { EkoService } from './eko.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AEPS_PATTERNS } from '@nexus/common/aeps/aeps.patterns';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';
import { IdentityDto } from 'libs/common/dto/IdentityDto';

@Controller()
export class EkoController {
  constructor(private readonly ekoService: EkoService) {}

  @MessagePattern(AEPS_PATTERNS.GET_ALL_SERVICES)
  async getAllServices(@Payload() dto: IdentityDto) {
    return this.ekoService.getAllServices();
  }
  @MessagePattern(AEPS_PATTERNS.ONBOARD_USER)
  async onboardUser(@Payload() dto: OnboardEkoUserDto) {
    console.log('KAFKA_RECEIVED:', dto);
    return this.ekoService.onboardUser(dto);
  }
}
