import { Test, TestingModule } from '@nestjs/testing';
import { IdentityBankAccountController } from './identity-bank-account.controller';

describe('IdentityBankAccountController', () => {
  let controller: IdentityBankAccountController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdentityBankAccountController],
    }).compile();

    controller = module.get<IdentityBankAccountController>(IdentityBankAccountController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
