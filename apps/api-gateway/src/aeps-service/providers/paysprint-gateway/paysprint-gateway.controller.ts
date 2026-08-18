import { Controller, Get } from '@nestjs/common';
import { PaysprintService } from 'apps/aeps-service/src/providers/paysprint/paysprint.service';

@Controller('paysprint-gateway')
export class PaysprintGatewayController {
  constructor(private readonly paySprintService: PaysprintService) {}

  // @Get("")
}
