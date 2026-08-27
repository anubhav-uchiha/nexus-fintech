import { Injectable } from '@nestjs/common';
import { EkoService } from './banks/providers/eko/eko.service';

@Injectable()
export class BankServiceService {
  constructor(private readonly ekoService: EkoService) {}

  getBankList() {
    return this.ekoService.bankList();
  }
}
