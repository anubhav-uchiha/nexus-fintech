import { Test, TestingModule } from '@nestjs/testing';
import { PaysprintController } from './paysprint.controller';

describe('PaysprintController', () => {
  let controller: PaysprintController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaysprintController],
    }).compile();

    controller = module.get<PaysprintController>(PaysprintController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
