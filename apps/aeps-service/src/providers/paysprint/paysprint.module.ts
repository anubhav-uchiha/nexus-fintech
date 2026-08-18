import { Module } from '@nestjs/common';
import { PaysprintController } from './paysprint.controller';
import { PaysprintService } from './paysprint.service';

@Module({
  controllers: [PaysprintController],
  providers: [PaysprintService]
})
export class PaysprintModule {}
