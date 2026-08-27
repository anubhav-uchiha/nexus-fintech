import { Test, TestingModule } from '@nestjs/testing';
import { VimopayKafkaController } from './vimopay.kafka.controller';

describe('VimopayKafkaController', () => {
  let controller: VimopayKafkaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VimopayKafkaController],
    }).compile();

    controller = module.get<VimopayKafkaController>(VimopayKafkaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
