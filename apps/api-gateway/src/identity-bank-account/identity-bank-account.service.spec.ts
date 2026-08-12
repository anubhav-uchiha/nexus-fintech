import { Test, TestingModule } from '@nestjs/testing';
import { IdentityBankAccountService } from './identity-bank-account.service';

describe('IdentityBankAccountService', () => {
  let service: IdentityBankAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IdentityBankAccountService],
    }).compile();

    service = module.get<IdentityBankAccountService>(IdentityBankAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
