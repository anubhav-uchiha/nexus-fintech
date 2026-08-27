import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { BankService } from './bank.service';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@Controller('bank')
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get('list')
  getBanksList() {
    // handle logic for fallbacks based on api response
    return this.bankService.getBanksList();
  }
}
