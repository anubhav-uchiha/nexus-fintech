import { Test, TestingModule } from '@nestjs/testing';
import { PaysprintGatewayController } from './paysprint-gateway.controller';

describe('PaysprintGatewayController', () => {
  let controller: PaysprintGatewayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaysprintGatewayController],
    }).compile();

    controller = module.get<PaysprintGatewayController>(PaysprintGatewayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
