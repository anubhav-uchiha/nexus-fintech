import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IdentityService } from '../identity/identity.service';
import { RoleService } from '../role/role.service';
import { PasswordService } from './password/password.service';
import { JwtService } from './jwt/jwt.service';
import { OtpPurpose, OtpType, UserStatus } from '../../generated/prisma/enums';
import { OtpService } from '../otp/otp.service';
import {
  LoginDto,
  LoginKafkaResponseDto,
  LogoutDto,
  RefreshKafkaResponseDto,
  RefreshTokenDto,
  RegisterDto,
  RegisterResponseDto,
  SendEmailOtpDto,
  SendPhoneOtpDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from '@nexus/common/auth';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'libs/cache/src';
import { SessionService } from '../session/session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly identityService: IdentityService,
    private readonly roleService: RoleService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
    private readonly sessionService: SessionService,
  ) {}

  async cacheTest() {
    await this.cache.set('hello', { name: 'Anubhav' }, 60);
    return this.cache.get('hello');
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const duplicate = await this.identityService.checkDuplicate(dto);

    switch (duplicate) {
      case 'email':
        throw new ConflictException('Email already exists.');

      case 'username':
        throw new ConflictException('Username already exists.');

      case 'phoneNumber':
        throw new ConflictException('Phone number already exists.');
    }
    const role = await this.roleService.findByName(dto.roleName);
    if (!role) {
      throw new BadRequestException('Invalid role');
    }

    const otpRequired = this.configService.get('app.otpVerificationRequired');

    if (otpRequired) {
      const phoneVerified = await this.otpService.isPhoneVerified(
        dto.phoneNumber,
      );

      if (!phoneVerified) {
        throw new BadRequestException('Phone number has not been verified');
      }

      const emailVerified = await this.otpService.isEmailVerified(dto.email);

      if (!emailVerified) {
        throw new BadRequestException('Email has not been verified');
      }
    }
    const hashPassword = await this.passwordService.hash(dto.password);

    const loginId = await this.identityService.generateLoginId();

    const identity = await this.identityService.create({
      loginId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      username: dto.username,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      password: hashPassword,

      isPhoneVerified: true,
      isEmailVerified: true,

      role: {
        connect: {
          id: role.id,
        },
      },
    });

    return {
      id: identity.id,
      loginId: identity.loginId,
      firstName: identity.firstName,
      lastName: identity.lastName,
      username: identity.username,
      email: identity.email,
      phoneNumber: identity.phoneNumber,
      role: identity.role.name,
      status: identity.status,
      createdAt: identity.createdAt,
    };
  }

  async login(dto: LoginDto): Promise<LoginKafkaResponseDto> {
    const identity = await this.identityService.findByIdentifier(
      dto.identifier,
    );

    if (!identity) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (identity.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        `Accound is ${identity.status.toLowerCase()}.`,
      );
    }

    console.log('Input Password:', dto.password);
    console.log('stored Password:', identity.password);

    const validPassword = await this.passwordService.verify(
      identity.password,
      dto.password,
    );

    if (!validPassword) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const payload = {
      sub: identity.id,
      username: identity.username,
      email: identity.email,
      role: identity.role.name,
    };

    const tokens = await this.jwtService.generateTokens(payload);

    await this.identityService.updateLastLogin(identity.id);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await this.sessionService.create({
      identityId: identity.id,
      refreshToken: tokens.refreshToken,
      expiresAt: refreshExpiry,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      identity: {
        id: identity.id,
        firstName: identity.firstName,
        lastName: identity.lastName,
        username: identity.username,
        email: identity.email,
        phoneNumber: identity.phoneNumber,
        role: identity.role.name,
        status: identity.status,
      },
    };
  }

  async sendPhoneOtp(dto: SendPhoneOtpDto) {
    return this.otpService.sendOtp({
      type: OtpType.PHONE,
      purpose: OtpPurpose.REGISTER,
      phoneNumber: dto.phoneNumber,
    });
  }

  async sendEmailOtp(dto: SendEmailOtpDto) {
    return this.otpService.sendOtp({
      type: OtpType.EMAIL,
      purpose: OtpPurpose.REGISTER,
      email: dto.email,
    });
  }

  async verifyPhoneOtp(dto: VerifyPhoneOtpDto) {
    return this.otpService.verifyOtp(
      OtpType.PHONE,
      OtpPurpose.REGISTER,
      dto.otp,
      dto.phoneNumber,
    );
  }

  async verifyEmailOtp(dto: VerifyEmailOtpDto) {
    return this.otpService.verifyOtp(
      OtpType.EMAIL,
      OtpPurpose.REGISTER,
      dto.otp,
      undefined,
      dto.email,
    );
  }
  async refresh(dto: RefreshTokenDto): Promise<RefreshKafkaResponseDto> {
    const session = await this.sessionService.findValidSession(
      dto.refreshToken,
    );

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = {
      sub: session.identity.id,
      username: session.identity.username,
      email: session.identity.email,
      role: session.identity.role.name,
    };

    const tokens = await this.jwtService.generateTokens(
      payload,
      session.expiresAt,
    );

    await this.sessionService.updateRefreshToken(
      session.id,
      tokens.refreshToken,
    );
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      identity: {
        id: session.identity.id,
        firstName: session.identity.firstName,
        lastName: session.identity.lastName,
        username: session.identity.username,
        email: session.identity.email,
        phoneNumber: session.identity.phoneNumber,
        role: session.identity.role.name,
        status: session.identity.status,
      },
    };
  }

  async logout(dto: LogoutDto) {
    const session = await this.sessionService.findByRefreshToken(
      dto.refreshToken,
    );
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.sessionService.revoke(session.id);

    return {
      message: 'Logged out successfully',
    };
  }
}
