import { Test, TestingModule } from '@nestjs/testing';
import { PaysprintGatewayService } from './paysprint-gateway.service';

describe('PaysprintGatewayService', () => {
  let service: PaysprintGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaysprintGatewayService],
    }).compile();

    service = module.get<PaysprintGatewayService>(PaysprintGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
