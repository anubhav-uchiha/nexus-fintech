// import {
//   Body,
//   Controller,
//   Get,
//   HttpCode,
//   HttpStatus,
//   Post,
// } from '@nestjs/common';
// import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// import { AuthService } from './auth.service';

// import {
//   LoginDto,
//   LoginResponseDto,
//   RegisterDto,
//   RegisterResponseDto,
//   SendEmailOtpDto,
//   SendPhoneOtpDto,
//   VerifyEmailOtpDto,
//   VerifyPhoneOtpDto,
// } from '@nexus/common/auth';

// @ApiTags('Authentication')
// @Controller('auth')
// export class AuthController {
//   constructor(private readonly authService: AuthService) {}

//   @Post('register')
//   @ApiOperation({
//     summary: 'Register a new identity',
//   })
//   @ApiResponse({ status: 201, type: RegisterResponseDto })
//   register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
//     return this.authService.register(dto);
//   }

//   @Post('login')
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({ summary: 'Login with email,username or phone number' })
//   @ApiResponse({ status: 200, type: LoginResponseDto })
//   login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
//     return this.authService.login(dto);
//   }

//   @Post('send-phone-otp')
//   sendPhoneOtp(@Body() dto: SendPhoneOtpDto) {
//     return this.authService.sendPhoneOtp(dto);
//   }

//   @Post('send-email-otp')
//   sendEmailOtp(@Body() dto: SendEmailOtpDto) {
//     return this.authService.sendEmailOtp(dto);
//   }

//   @Post('verify-phone-otp')
//   verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto) {
//     return this.authService.verifyPhoneOtp(dto);
//   }

//   @Post('verify-email-otp')
//   verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
//     return this.authService.verifyEmailOtp(dto);
//   }

//   @Get('cache-test')
//   cacheTest() {
//     return this.authService.cacheTest();
//   }
// }
