import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Body,
  Post,
} from '@nestjs/common';
import { VimopayMerchantRegistrationDto } from './dto/merchant-registration.dto';
import {
  VimopayMerchantOtpDto,
  VimopayValidateMerchantOtpDto,
} from './dto/merchant-otp.dto';

import { ConfigService } from '@nestjs/config';
import { VimopayService } from './vimopay.service';

import { VimopayMerchantEkycDto } from './dto/merchant-ekyc.dto';
import { VimopayTwoFactorAuthDto } from './dto/two-factor-auth.dto';
import { VimopayBalanceEnquiryDto } from './dto/balance-enquiry.dto';
import { VimopayMiniStatementDto } from './dto/mini-statement.dto';
import { VimopayCashWithdrawalDto } from './dto/cash-withdrawal.dto';
import { VimopayAepsTransactionOtpDto } from './dto/aeps-transaction-otp.dto';
import { VimopayAadhaarPayDto } from './dto/aadhaar-pay.dto';
import { VimopayCashDepositDto } from './dto/cash-deposit.dto';
import { VimopayDistrictRequestDto } from './dto/district-request.dto';
import { VimopayBankIinRequestDto } from './dto/bank-iin-request.dto';



@Controller('_debug/vimopay')
export class VimopayDebugController {
  constructor(
    private readonly vimopayService: VimopayService,

    private readonly configService: ConfigService,
  ) {}

  /*
   * Partner Authorization
   */
  @Get('authorize')
  async authorize() {
    this.ensureDebugAllowed();

    return this.vimopayService.authorize();
  }

  /*
   * Bank List
   */
  @Get('banks')
  async getBankList() {
    this.ensureDebugAllowed();

    return this.vimopayService.getBankList();
  }

  /*
   * State List
   */
  @Get('states')
  async getStateList() {
    this.ensureDebugAllowed();

    return this.vimopayService.getStateList();
  }

  /*
   * District List
   *
   * Example:
   *
   * /_debug/vimopay/districts?stateCode=DL
   */
  @Get('districts')
  async getDistrictList(
    @Query()
    query: VimopayDistrictRequestDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.getDistrictList(query);
  }

  /*
   * Bank IIN List
   *
   * Example:
   *
   * /_debug/vimopay/bank-iins?txnCode=BE&authType=BA
   */
  @Get('bank-iins')
  async getBankIinList(
    @Query()
    query: VimopayBankIinRequestDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.getBankIinList(query);
  }

  private ensureDebugAllowed(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv === 'production') {
      throw new NotFoundException();
    }
  }
  @Post('merchant/register')
  async registerMerchant(
    @Body()
    body: VimopayMerchantRegistrationDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.registerMerchant(body);
  }
  @Post('merchant/otp/send')
  async sendMerchantOtp(
    @Body()
    body: VimopayMerchantOtpDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.sendMerchantOtp(body);
  }

  @Post('merchant/otp/resend')
  async resendMerchantOtp(
    @Body()
    body: VimopayMerchantOtpDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.resendMerchantOtp(body);
  }

  @Post('merchant/otp/validate')
  async validateMerchantOtp(
    @Body()
    body: VimopayValidateMerchantOtpDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.validateMerchantOtp(body);
  }

  @Post('merchant/ekyc')
  async merchantEkyc(
    @Body()
    body: VimopayMerchantEkycDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.merchantEkyc(body);
  }

  @Post('merchant/2fa')
  async twoFactorAuth(
    @Body()
    body: VimopayTwoFactorAuthDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.twoFactorAuth(body);
  }

  @Post('raw/transaction/balance-enquiry')
  async balanceEnquiry(
    @Body()
    body: VimopayBalanceEnquiryDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.balanceEnquiry(body);
  }

  @Post('raw/transaction/mini-statement')
  async miniStatement(
    @Body()
    body: VimopayMiniStatementDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.miniStatement(body);
  }

  @Post('raw/transaction/cash-withdrawal')
  async cashWithdrawal(
    @Body()
    body: VimopayCashWithdrawalDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.cashWithdrawal(body);
  }

  @Post('raw/transaction/otp')
  async sendTransactionOtp(
    @Body()
    body: VimopayAepsTransactionOtpDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.sendAepsTransactionOtp(body);
  }

  @Post('raw/transaction/aadhaar-pay')
  async aadhaarPay(
    @Body()
    body: VimopayAadhaarPayDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.aadhaarPay(body);
  }

  @Post('raw/transaction/cash-deposit')
  async cashDeposit(
    @Body()
    body: VimopayCashDepositDto,
  ) {
    this.ensureDebugAllowed();

    return this.vimopayService.cashDeposit(body);
  }
}
