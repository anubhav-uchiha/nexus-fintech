import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EkoService } from './eko.service';
import { CurrentUser } from 'apps/api-gateway/src/auth/decorator/current-user.decorator';
import { IdentityDto } from 'libs/common/dto/IdentityDto';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';
import { JwtAuthGuard } from 'apps/api-gateway/src/auth/guards/jwt-auth-guard';

@Controller('eko')
// @UseGuards(JwtAuthGuard)
import { Body, Controller, Get } from '@nestjs/common';
import { EkoService } from './eko.service';
import { CurrentUser } from 'apps/api-gateway/src/auth/decorator/current-user.decorator';
import { IdentityDto } from 'libs/common/dto/IdentityDto';

@Controller('eko')
export class EkoController {
  constructor(private readonly ekoService: EkoService) {}

  @Get('services')
  getAllServices() {
    return this.ekoService.getAllEkoServices();
  }

  @Post('onboard-merchant')
  onboardUser(@Body() dto: OnboardEkoUserDto) {
    return this.ekoService.OnboardMerchant(dto);
  }

  @Get("banks-list")
  getBankList(){
    return this.ekoService.getBankList()
  }
}
