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

import { AdminGatewayService } from './admin.gateway.service';

import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

interface AuthenticatedUser {
  sub: string;
  sid: string;
  accountType: string;
  role: string;
}

@ApiTags('Accounts')
@ApiBearerAuth('access-token')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class AccountController {
  constructor(private readonly adminGatewayService: AdminGatewayService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an account based on role registration permissions',
    description:
      'Creates a new account only when the logged-in identity role is allowed to register the requested target role.',
  })
  @ApiCreatedResponse({
    description: 'Account created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid account payload, invalid role, or invalid account data',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or the session is invalid',
  })
  @ApiForbiddenResponse({
    description:
      'The logged-in account is not allowed to create the requested role, the account is inactive, or onboarding is incomplete',
  })
  @ApiConflictResponse({
    description:
      'Email, username, phone number, or another unique account field is already registered',
  })
  createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdminAccountDto,
  ) {
    return this.adminGatewayService.createAccount(user.sub, dto);
  }
}
