import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ADMIN_PATTERNS, CreateAdminAccountDto } from '@nexus/common/admin';
import { AdminServiceService } from './admin-service.service';

@Controller()
export class AdminServiceController {
  constructor(private readonly adminService: AdminServiceService) {}

  @MessagePattern(ADMIN_PATTERNS.CREATE_ACCOUNT)
  createAccount(
    @Payload()
    payload: {
      creatorIdentityId: string;
      account: CreateAdminAccountDto;
    },
  ) {
    return this.adminService.createAccount(
      payload.creatorIdentityId,
      payload.account,
    );
  }
}
