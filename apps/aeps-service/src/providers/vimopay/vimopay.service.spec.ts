import { Test, TestingModule } from '@nestjs/testing';
import { VimopayService } from './vimopay.service';

describe('VimopayService', () => {
  let service: VimopayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VimopayService],
    }).compile();

    service = module.get<VimopayService>(VimopayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
