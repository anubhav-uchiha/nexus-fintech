import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CreateAdminAccountDto } from '@nexus/common/admin';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { SuperAdminAuthGuard } from '../auth/guards/super-admin-auth.guard';

import { SuperAdminOnboardingGuard } from '../auth/guards/super-admin-onboarding.guard';

import { AdminGatewayService } from './admin.gateway.service';

import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

interface AuthenticatedSuperAdmin {
  sub: string;
  sid: string;
  accountType: 'SUPER_ADMIN';
  role: 'SUPER_ADMIN';
}

@ApiTags('Super Admin - Accounts')
@ApiBearerAuth('access-token')
@Controller('super-admin')
@UseGuards(SuperAdminAuthGuard, SuperAdminOnboardingGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class AdminController {
  constructor(private readonly adminGatewayService: AdminGatewayService) {}

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an account as Super Admin',
    description:
      'Creates a new managed account when the authenticated Super Admin is permitted to register the requested target role.',
  })
  @ApiCreatedResponse({
    description: 'Account created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid account payload, invalid role, inactive target role, or invalid account data',
  })
  @ApiUnauthorizedResponse({
    description:
      'Super Admin access token is missing, invalid, expired, or the session is invalid',
  })
  @ApiForbiddenResponse({
    description:
      'Super Admin onboarding is incomplete, the Super Admin account or role is inactive, or the requested role cannot be created',
  })
  @ApiConflictResponse({
    description:
      'Email, username, phone number, or another unique account field is already registered',
  })
  createAccount(
    @CurrentUser()
    superAdmin: AuthenticatedSuperAdmin,

    @Body()
    dto: CreateAdminAccountDto,
  ) {
    return this.adminGatewayService.createAccount(superAdmin.sub, dto);
  }
}
