import { Module } from '@nestjs/common';
import { PaysprintGatewayService } from './paysprint-gateway.service';
import { PaysprintGatewayController } from './paysprint-gateway.controller';

@Module({
  providers: [PaysprintGatewayService],
  controllers: [PaysprintGatewayController]
})
export class PaysprintGatewayModule {}
