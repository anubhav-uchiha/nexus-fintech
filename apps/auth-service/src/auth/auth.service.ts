import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IdentityService } from '../identity/identity.service';
import { RoleService } from '../role/role.service';
import { PasswordService } from './password/password.service';
import { JwtService } from './jwt/jwt.service';
import {
  LoginMethod,
  OtpPurpose,
  OtpType,
  RegistrationStep,
  UserStatus,
} from '../../generated/prisma/enums';
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
import { RegisterDetailsDto } from '@nexus/common/auth/dto/register/register-details.dto';
import { RegisterPanDto } from '@nexus/common/auth/dto/register/register-pan.dto';
import { VerifyRegistrationOtpDto } from '@nexus/common/auth/dto/register/verify-registration-otp.dto';
import { RegisterPhoneDto } from '@nexus/common/auth/dto/register/register-phone.dto';
import { RegisterRoleDto } from '@nexus/common/auth/dto/register/register-role.dto';
import { generateMpin } from './utils/mpin-generator';
import { generatePassword } from './utils/password-generator';

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

  async registerRole(dto: RegisterRoleDto) {
    console.log('SERVICE HIT');
    const role = await this.roleService.findByName(dto.role);

    if (!role) {
      throw new BadRequestException('Invalid role');
    }

    const draft = await this.identityService.createRegistrationDraft({
      role: {
        connect: {
          id: role.id,
        },
      },
      registrationStep: 'ROLE_SELECTED',
    });

    return {
      draftId: draft.id,
      nextStep: 'PHONE_VERIFICATION',
      message: 'Role selected successfully.',
    };
  }

  async registerSendOtp(dto: RegisterPhoneDto) {
    const draft = await this.identityService.findRegistrationDraft(dto.draftId);

    if (!draft) {
      throw new BadRequestException('Registration draft not found');
    }

    if (draft.registrationStep !== 'ROLE_SELECTED') {
      throw new BadRequestException(
        'Phone verification step already completed',
      );
    }

    const existingIdentity = await this.identityService.findByPhoneNumber(
      dto.phoneNumber,
    );

    if (existingIdentity) {
      throw new ConflictException('Phone number already registered');
    }

    const existingDraft =
      await this.identityService.findRegistrationDraftByPhone(dto.phoneNumber);

    if (existingDraft && existingDraft.id !== draft.id) {
      throw new ConflictException(
        'Phone number already used for another registration',
      );
    }

    await this.identityService.updateRegistrationDraft(draft.id, {
      phoneNumber: dto.phoneNumber,
    });

    const otp = await this.otpService.sendOtp({
      type: OtpType.PHONE,
      purpose: OtpPurpose.REGISTER,
      phoneNumber: dto.phoneNumber,
    });

    return {
      draftId: draft.id,
      otp,
      nextStep: 'VERIFY_PHONE_OTP',
      message: 'OTP sent successfully',
    };
  }

  async registerVerifyOtp(dto: VerifyRegistrationOtpDto) {
    const draft = await this.identityService.findRegistrationDraft(dto.draftId);

    if (!draft) {
      throw new BadRequestException('Registration draft not found');
    }

    if (!draft.phoneNumber) {
      throw new BadRequestException(
        'Phone number not found in registration draft',
      );
    }

    if (draft.registrationStep !== 'ROLE_SELECTED') {
      throw new BadRequestException(
        'Phone verification has already been completed',
      );
    }

    if (draft.phoneNumber !== dto.phoneNumber) {
      throw new BadRequestException('Phone number does not match');
    }

    await this.otpService.verifyOtp(
      OtpType.PHONE,
      OtpPurpose.REGISTER,
      dto.otp,
      dto.phoneNumber,
    );

    await this.identityService.updateRegistrationDraft(draft.id, {
      isPhoneVerified: true,
      registrationStep: 'PHONE_VERIFIED',
    });

    return {
      draftId: draft.id,
      nextStep: 'PAN_VERIFICATION',
      message: 'Phone verified successfully',
    };
  }

  async registerPan(dto: RegisterPanDto) {
    const draft = await this.identityService.findRegistrationDraft(dto.draftId);

    if (!draft) {
      throw new BadRequestException('Registration draft not found');
    }

    if (draft.registrationStep !== 'PHONE_VERIFIED') {
      throw new BadRequestException('Complete phone verification first');
    }

    if (!draft.isPhoneVerified) {
      throw new BadRequestException('Phone number is not verified');
    }

    const existingIdentity = await this.identityService.findByPanNumber(
      dto.panNumber,
    );

    if (existingIdentity) {
      throw new ConflictException('PAN number already registered');
    }

    const existingDraft = await this.identityService.findRegistrationDraftByPan(
      dto.panNumber,
    );

    if (existingDraft && existingDraft.id !== draft.id) {
      throw new ConflictException(
        'PAN number already used in another registration',
      );
    }

    // Future PAN Verification API
    // const panResult = await this.panService.verify(dto.panNumber);

    await this.identityService.updateRegistrationDraft(draft.id, {
      panNumber: dto.panNumber,
      isPanVerified: true,
      registrationStep: 'PAN_VERIFIED',
    });

    return {
      draftId: draft.id,
      nextStep: 'REGISTRATION_DETAILS',
      message: 'PAN added successfully',
    };
  }

  async registerDetails(dto: RegisterDetailsDto) {
    const draft = await this.identityService.findRegistrationDraft(dto.draftId);

    if (!draft) {
      throw new BadRequestException('Registration draft not found');
    }

    if (
      draft.registrationStep !== RegistrationStep.PAN_VERIFIED ||
      !draft.isPhoneVerified ||
      !draft.isPanVerified
    ) {
      throw new BadRequestException(
        'Complete previous registration steps first.',
      );
    }
    const emailExists = await this.identityService.findByEmail(dto.email);

    if (emailExists) {
      throw new ConflictException('Email already registered.');
    }

    const usernameExists = await this.identityService.findByUsername(
      dto.username,
    );

    if (usernameExists) {
      throw new ConflictException('Username already registered.');
    }

    const aadhaarExists = await this.identityService.findByAadhaarNumber(
      dto.aadhaarNumber,
    );

    if (aadhaarExists) {
      throw new ConflictException('Aadhaar already registered.');
    }

    const loginId = await this.identityService.generateLoginId();
    const password = generatePassword();
    const mpin = generateMpin();

    const hashedPassword = await this.passwordService.hash(password);
    const hashedMpin = await this.passwordService.hash(mpin);

    const identity = await this.identityService.completeRegistration({
      draftId: draft.id,
      identity: {
        loginId,
        fullName: dto.fullName,
        username: dto.username,
        email: dto.email,
        phoneNumber: draft.phoneNumber!,
        password: hashedPassword,
        mpin: hashedMpin,
        aadhaarNumber: dto.aadhaarNumber,
        panNumber: draft.panNumber!,
        shopName: dto.shopName,
        shopAddress: dto.shopAddress,
        shopCity: dto.shopCity,
        shopState: dto.shopState,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        status: UserStatus.ACTIVE,
        isEmailVerified: false,
        isPhoneVerified: true,
        isPanVerified: false,
        registrationStep: RegistrationStep.COMPLETED,
        preferredLoginMethod: LoginMethod.LOGIN_ID,
        role: {
          connect: {
            id: draft.roleId,
          },
        },
      },
    });

    // 7. Send SMS (Implement Later)

    /*
  await this.kafkaProducer.publish(KAFKA_TOPICS.SMS_SEND, {
      phoneNumber: identity.phoneNumber,
      message: `
Welcome to KRT

Login ID : ${loginId}
Password : ${password}
MPIN : ${mpin}

Please change your password after first login.
`
  });
  */
    return {
      success: true,
      message: 'Registration completed successfully.',
      loginId: identity.loginId,
      temporaryPassword: password,
      temporaryMpin: mpin,
    };
  }

  async changeLoginMethod(dto: {
    identityId: string;
    preferredLoginMethod: LoginMethod;
  }) {
    const identity = await this.identityService.updatePreferredLoginMethod(
      dto.identityId,
      dto.preferredLoginMethod,
    );

    return {
      success: true,
      message: 'Preferred login method updated successfully.',
      preferredLoginMethod: identity.preferredLoginMethod,
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

    let isValid = false;

    if (dto.loginWith === 'PASSWORD') {
      isValid = await this.passwordService.verify(
        identity.password,
        dto.password,
      );
    } else if (dto.loginWith === 'MPIN') {
      isValid = await this.passwordService.verify(identity.mpin, dto.password);
    } else {
      throw new BadRequestException('Invalid login type');
    }

    if (!isValid) {
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
        loginId: identity.loginId,
        fullName: identity.fullName,
        username: identity.username,
        email: identity.email,
        phoneNumber: identity.phoneNumber,
        role: identity.role.name,
        status: identity.status,
        preferredLoginMethod: identity.preferredLoginMethod,
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
        fullName: session.identity.fullName,
        username: session.identity.username,
        email: session.identity.email,
        phoneNumber: session.identity.phoneNumber,
        role: session.identity.role.name,
        status: session.identity.status,
        preferredLoginMethod: session.identity.preferredLoginMethod,
      },
    };
  }

  async changePassword(dto: {
    identityId: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const user = await this.identityService.findById(dto.identityId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatch = await this.passwordService.verify(
      user.password,
      dto.currentPassword,
    );

    if (!passwordMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);

    await this.identityService.updatePassword(dto.identityId, hashedPassword);

    return {
      message: 'Password changed successfully',
    };
  }

  async changeMpin(dto: {
    identityId: string;
    currentMpin: string;
    newMpin: string;
  }) {
    const user = await this.identityService.findById(dto.identityId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mpinMatch = await this.passwordService.verify(
      user.mpin,
      dto.currentMpin,
    );

    if (!mpinMatch) {
      throw new BadRequestException('Current MPIN is incorrect');
    }

    if (dto.currentMpin === dto.newMpin) {
      throw new BadRequestException(
        'New MPIN must be different from current MPIN',
      );
    }

    const hashedMpin = await this.passwordService.hash(dto.newMpin);

    await this.identityService.updateMpin(dto.identityId, hashedMpin);
    return {
      message: 'MPIN changed successfully',
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
