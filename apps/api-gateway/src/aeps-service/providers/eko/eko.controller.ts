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
}
