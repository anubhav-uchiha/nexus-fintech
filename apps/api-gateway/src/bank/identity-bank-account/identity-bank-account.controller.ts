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
import { ApiOperation } from '@nestjs/swagger';
import { CreateBankAccountDto } from '@nexus/common/identity-bank-account/dto/create-bank-account.dto';
import { Id7Dto } from 'libs/common/dto/Id7Dto';
import { UpdateBankAccountDto } from '@nexus/common/identity-bank-account/dto/update-bank-account.dto';
import { UpdateBankAccountStatusDto } from '@nexus/common/identity-bank-account/dto/update-bank-account-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth-guard';
import { JwtPayload } from '../../auth/intercaces/jwt-payload.interface';
import { CurrentUser } from '../../auth/decorator/current-user.decorator';
import { RpcToHttpExceptionInterceptor } from '../../common/interceptors/rpc-to-http-exception';

@Controller('identity')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class IdentityBankAccountController {
  constructor(
    private readonly identityBankAccountService: IdentityBankAccountService,
  ) {}

  @Post('bank-accounts')
  @ApiOperation({
    summary: 'create-bank-account',
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
    summary: 'get-my-bank-accounts',
  })
  getMyBankAccounts(@CurrentUser() user: JwtPayload) {
    return this.identityBankAccountService.getMyBankAccounts({
      identityId: user.sub,
    });
  }

  @Get('get-my-bank-account/:id')
  @ApiOperation({
    summary: 'get-my-bank-account/:id',
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
    summary: 'update-my-bank-account/:id',
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
    summary: ':userId/update-bank-account-status/:bankId',
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
    summary: 'delete-my-bank-account/:id',
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
    summary: 'bank-accounts/:bankId/set-primary',
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
    summary: 'my-bank-accounts/primary',
  })
  getMyPrimaryBankAccount(@CurrentUser() user: JwtPayload) {
    return this.identityBankAccountService.getMyPrimaryBankAccount({
      identityId: user.sub,
    });
  }
}
