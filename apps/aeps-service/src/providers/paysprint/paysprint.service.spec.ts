import { Test, TestingModule } from '@nestjs/testing';
import { PaysprintService } from './paysprint.service';

describe('PaysprintService', () => {
  let service: PaysprintService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaysprintService],
    }).compile();

    service = module.get<PaysprintService>(PaysprintService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
