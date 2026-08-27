import { Test, TestingModule } from '@nestjs/testing';
import { EkoService } from './eko.service';

describe('EkoService', () => {
  let service: EkoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EkoService],
    }).compile();

    service = module.get<EkoService>(EkoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
