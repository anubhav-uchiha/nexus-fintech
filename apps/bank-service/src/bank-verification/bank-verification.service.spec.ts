import { Test, TestingModule } from '@nestjs/testing';
import { BankVerificationService } from './bank-verification.service';

describe('BankVerificationService', () => {
  let service: BankVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BankVerificationService],
    }).compile();

    service = module.get<BankVerificationService>(BankVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
