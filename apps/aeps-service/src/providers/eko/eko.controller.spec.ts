import { Test, TestingModule } from '@nestjs/testing';
import { EkoController } from '../../../eko/eko.controller';

describe('EkoController', () => {
  let controller: EkoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EkoController],
    }).compile();

    controller = module.get<EkoController>(EkoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
