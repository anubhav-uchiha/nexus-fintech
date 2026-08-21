import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EkoService } from './eko.service';
import { JwtAuthGuard } from 'apps/api-gateway/src/auth/guards/jwt-auth-guard';
import { RpcToHttpExceptionInterceptor } from 'apps/api-gateway/src/common/interceptors/rpc-to-http-exception';
import { CurrentUser } from 'apps/api-gateway/src/auth/decorator/current-user.decorator';
import { JwtPayload } from 'apps/auth-service/src/auth/jwt/interfaces/jwt-payload.interface';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';

@Controller('eko')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class EkoController {
  constructor(private readonly ekoService: EkoService) {}

  @Get('services')
  getAllServices() {
    return this.ekoService.getAllEkoServices();
  }

  @Post('onboard-merchant')
  onboardUser(@CurrentUser() user: JwtPayload, @Body() dto: OnboardEkoUserDto) {
    return this.ekoService.onboardMerchant(user.sub, dto);
  }
}
