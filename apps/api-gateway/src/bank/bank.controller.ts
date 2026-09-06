import { Controller, Get, UseInterceptors } from '@nestjs/common';

import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { BankService } from './bank.service';

import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@ApiTags('Bank')
@Controller('bank')
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Get supported bank list',
    description:
      'Returns the list of banks available for supported banking and fintech operations.',
  })
  @ApiOkResponse({
    description: 'Bank list retrieved successfully',
  })
  @ApiServiceUnavailableResponse({
    description: 'Bank provider or upstream service is temporarily unavailable',
  })
  getBanksList() {
    // Handle fallback logic based on provider/API response.
    return this.bankService.getBanksList();
  }
}
