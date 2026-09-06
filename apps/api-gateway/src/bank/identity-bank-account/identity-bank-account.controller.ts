import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IdentityBankAccountService } from './identity-bank-account.service';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateBankAccountDto } from '@nexus/common/identity-bank-account/dto/create-bank-account.dto';
import { Id7Dto } from 'libs/common/dto/Id7Dto';
import { UpdateBankAccountDto } from '@nexus/common/identity-bank-account/dto/update-bank-account.dto';
import { UpdateBankAccountStatusDto } from '@nexus/common/identity-bank-account/dto/update-bank-account-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth-guard';
import { JwtPayload } from '../../auth/intercaces/jwt-payload.interface';
import { CurrentUser } from '../../auth/decorator/current-user.decorator';
import { RpcToHttpExceptionInterceptor } from '../../common/interceptors/rpc-to-http-exception';

@ApiTags('Identity Bank Accounts')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Access token is missing, invalid, expired, or the session is invalid',
})
@Controller('identity')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class IdentityBankAccountController {
  constructor(
    private readonly identityBankAccountService: IdentityBankAccountService,
  ) {}

  @Post('bank-accounts')
  @ApiOperation({
    summary: 'Create bank account',
    description:
      'Creates a new bank account for the currently authenticated identity.',
  })
  @ApiCreatedResponse({
    description: 'Bank account created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid bank account payload',
  })
  @ApiConflictResponse({
    description:
      'Bank account already exists or conflicts with an existing account',
  })
  createBankAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBankAccountDto,
  ) {
    console.log('create bank account controller hit');
    return this.identityBankAccountService.createBankAccount(
      { identityId: user.sub },
      dto,
    );
  }

  @Get('get-my-bank-accounts')
  @ApiOperation({
    summary: 'Get my bank accounts',
    description:
      'Returns all bank accounts belonging to the currently authenticated identity.',
  })
  @ApiOkResponse({
    description: 'Bank accounts retrieved successfully',
  })
  getMyBankAccounts(@CurrentUser() user: JwtPayload) {
    return this.identityBankAccountService.getMyBankAccounts({
      identityId: user.sub,
    });
  }

  @Get('get-my-bank-account/:id')
  @ApiOperation({
    summary: 'Get my bank account by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Bank account ID',
  })
  @ApiOkResponse({
    description: 'Bank account retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Bank account not found',
  })
  getMyBankAccount(
    @CurrentUser() user: JwtPayload,
    @Param() bankId: { id: string },
  ) {
    console.log(bankId);
    return this.identityBankAccountService.getMyBankAccount(
      { identityId: user.sub },
      bankId.id,
    );
  }

  @Patch('/update-my-bank-account/:id')
  @ApiOperation({
    summary: 'Update my bank account',
    description:
      'Updates an existing bank account owned by the currently authenticated identity.',
  })
  @ApiParam({
    name: 'id',
    description: 'Bank account ID',
  })
  @ApiOkResponse({
    description: 'Bank account updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid bank account update payload',
  })
  @ApiNotFoundResponse({
    description: 'Bank account not found',
  })
  @ApiConflictResponse({
    description: 'Updated bank account data conflicts with another account',
  })
  updateMyBankAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateBankAccountDto,
    @Param() bankId: { id: string },
  ) {
    return this.identityBankAccountService.updateMyBankAccount(
      { identityId: user.sub },
      dto,
      bankId.id,
    );
  }

  // higher-authority-control
  @Patch(':identityId/update-bank-account-status/:bankId')
  @ApiOperation({
    summary: 'Update identity bank account status',
    description:
      'Updates the status of a bank account belonging to the specified identity.',
  })
  @ApiParam({
    name: 'identityId',
    description: 'Identity ID',
  })
  @ApiParam({
    name: 'bankId',
    description: 'Bank account ID',
  })
  @ApiOkResponse({
    description: 'Bank account status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid bank account status payload',
  })
  @ApiNotFoundResponse({
    description: 'Identity or bank account not found',
  })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not allowed to update this bank account status',
  })
  updateMyBankAccountStatus(
    @Param('identityId') identityId: string,
    @Param('bankId') bankId: string,
    @Body() dto: UpdateBankAccountStatusDto,
  ) {
    return this.identityBankAccountService.updateMyBankAccountStatus(
      identityId,
      bankId,
      dto,
    );
  }

  @Delete('delete-my-bank-account/:id')
  @ApiOperation({
    summary: 'Delete my bank account',
    description:
      'Deletes a bank account belonging to the currently authenticated identity.',
  })
  @ApiParam({
    name: 'id',
    description: 'Bank account ID',
  })
  @ApiOkResponse({
    description: 'Bank account deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Bank account not found',
  })
  @ApiConflictResponse({
    description:
      'Bank account cannot be deleted because of its current state or dependencies',
  })
  removeMyBankAccount(
    @CurrentUser() user: JwtPayload,
    @Param() bankId: Id7Dto,
  ) {
    return this.identityBankAccountService.deleteMyBankAccount({
      identityId: user.sub,
      bankId: bankId.id,
    });
  }

  @Patch('my-bank-accounts/:bankId/set-primary')
  @ApiOperation({
    summary: 'Set my primary bank account',
    description:
      'Marks the selected bank account as the primary bank account for the authenticated identity.',
  })
  @ApiParam({
    name: 'bankId',
    description: 'Bank account ID',
  })
  @ApiOkResponse({
    description: 'Primary bank account updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Bank account cannot be set as primary in its current state',
  })
  @ApiNotFoundResponse({
    description: 'Bank account not found',
  })
  setMyBankAccountAsPrimary(
    @CurrentUser() user: JwtPayload,
    @Param('bankId') bankId: string,
  ) {
    return this.identityBankAccountService.setMyBankAccountAsPrimary(
      {
        identityId: user.sub,
      },
      bankId,
    );
  }

  @Get('my-bank-accounts/primary')
  @ApiOperation({
    summary: 'Get my primary bank account',
    description:
      'Returns the primary bank account for the currently authenticated identity.',
  })
  @ApiOkResponse({
    description: 'Primary bank account retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Primary bank account not found',
  })
  getMyPrimaryBankAccount(@CurrentUser() user: JwtPayload) {
    return this.identityBankAccountService.getMyPrimaryBankAccount({
      identityId: user.sub,
    });
  }
}
