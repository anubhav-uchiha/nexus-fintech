import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import dayjs from 'dayjs';
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
  LoginKafkaResponseDto,
  LogoutDto,
  RefreshKafkaResponseDto,
  RefreshTokenDto,
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
import { VerifyForgotPasswordUserDto } from '@nexus/common/auth/dto/forgot-password/verify-user.dto';
import { VerifyForgotPasswordOtpDto } from '@nexus/common/auth/dto/forgot-password/verify-forgot-password-otp.dto';
import { ResetForgotPasswordDto } from '@nexus/common/auth/dto/forgot-password/reset-forgot-password.dto';
import { createHash, randomUUID } from 'crypto';
import { JwtPayload } from './jwt/interfaces/jwt-payload.interface';
import { LoginKafkaDto } from '@nexus/common/auth/dto/login-kafka.dto';
import { KAFKA_TOPICS, KafkaProducerService } from 'libs/kafka/src';
import { AUDIT_PATTERNS, CreateAuditLogDto } from '@nexus/common/audit';
import { isPeerTransferRole } from '@nexus/common/wallet/peer-transfer.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly identityService: IdentityService,
    private readonly roleService: RoleService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
    private readonly sessionService: SessionService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  private queueAuditLog(data: Omit<CreateAuditLogDto, 'eventId'>): void {
    void this.publishAuditLog(data);
  }

  async registerRole(dto: RegisterRoleDto) {
    const role = await this.roleService.findByName(dto.role);

    if (!role || !role.isActive) {
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

    const otpResult = await this.otpService.sendOtp({
      type: OtpType.PHONE,
      purpose: OtpPurpose.REGISTER,
      phoneNumber: dto.phoneNumber,
    });

    return {
      draftId: draft.id,
      nextStep: 'VERIFY_PHONE_OTP',
      ...otpResult,
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

    const panNumber = dto.panNumber.trim().toUpperCase();

    const existingIdentity =
      await this.identityService.findByPanNumber(panNumber);

    if (existingIdentity) {
      throw new ConflictException('PAN number already registered');
    }

    const existingDraft =
      await this.identityService.findRegistrationDraftByPan(panNumber);

    if (existingDraft && existingDraft.id !== draft.id) {
      throw new ConflictException(
        'PAN number already used in another registration',
      );
    }

    // Future PAN Verification API
    // const panResult = await this.panService.verify(dto.panNumber);

    await this.identityService.updateRegistrationDraft(draft.id, {
      panNumber,
      isPanVerified: false,
      registrationStep: RegistrationStep.PAN_VERIFIED,
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
      !draft.panNumber
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
    const password = generatePassword();
    const mpin = generateMpin();

    const hashedPassword = await this.passwordService.hash(password);
    const hashedMpin = await this.passwordService.hash(mpin);

    const identity = await this.identityService.completeRegistration({
      draftId: draft.id,
      identity: {
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
      },
    });

    const credentialEventId = `registration-credentials-${identity.id}`;

    let credentialsDeliveryQueued = false;

    try {
      await this.kafkaProducer.publish(KAFKA_TOPICS.SMS_SEND, {
        eventId: credentialEventId,
        phoneNumber: identity.phoneNumber,
        message: [
          'Welcome to UmiPay',
          '',
          `Login ID: ${identity.loginId}`,
          `Temporary Password: ${password}`,
          `Temporary MPIN: ${mpin}`,
          '',
          'Please change your password and MPIN after your first login.',
        ].join('\n'),
      });

      credentialsDeliveryQueued = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown credential notification error';

      this.logger.error(
        `Registration completed, but credentials could not be queued: ${message}`,
      );
    }

    const showTemporaryCredentials = process.env.NODE_ENV === 'development';

    return {
      success: true,
      message: credentialsDeliveryQueued
        ? 'Registration completed successfully. Credentials have been sent by SMS.'
        : 'Registration completed, but credentials could not be sent. Use forgot password to create a new password.',
      loginId: identity.loginId,
      credentialsDeliveryQueued,
      ...(showTemporaryCredentials && {
        temporaryPassword: password,
        temporaryMpin: mpin,
      }),
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

  async login(dto: LoginKafkaDto): Promise<LoginKafkaResponseDto> {
    let auditIdentity: {
      id: string;
      loginId: string;
      role: {
        name: string;
      };
    } | null = null;

    try {
      const hasLatitude = dto.latitude !== undefined;
      const hasLongitude = dto.longitude !== undefined;

      if (hasLatitude !== hasLongitude) {
        throw new BadRequestException(
          'Latitude and longitude must be provided together',
        );
      }

      if (
        !hasLatitude &&
        (dto.locationAccuracy !== undefined ||
          dto.locationCapturedAt !== undefined)
      ) {
        throw new BadRequestException(
          'Location accuracy and capture time require latitude and longitude',
        );
      }

      if (dto.loginWith !== 'PASSWORD' && dto.loginWith !== 'MPIN') {
        throw new BadRequestException('Invalid login type');
      }

      await this.checkLoginRateLimit(dto);

      const identity = await this.identityService.findByIdentifier(
        dto.identifier,
      );

      if (!identity) {
        await this.recordFailedLoginAttempt(dto);
        throw new UnauthorizedException('Invalid credentials');
      }
      auditIdentity = identity;

      if (identity.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException(
          `Account is ${identity.status.toLowerCase()}.`,
        );
      }

      if (!identity.role.isActive) {
        throw new ForbiddenException('Account role is inactive');
      }

      const credentialHash =
        dto.loginWith === 'PASSWORD' ? identity.password : identity.mpin;

      const isValid = await this.passwordService.verify(
        credentialHash,
        dto.password,
      );

      if (!isValid) {
        await this.recordFailedLoginAttempt(dto);

        throw new UnauthorizedException('Invalid credentials');
      }

      await this.clearLoginAttempts(dto);

      const location =
        hasLatitude && hasLongitude
          ? {
              latitude: Number(dto.latitude!.toFixed(6)),
              longitude: Number(dto.longitude!.toFixed(6)),
              ...(dto.locationAccuracy !== undefined && {
                locationAccuracy: dto.locationAccuracy,
              }),

              locationCapturedAt: dto.locationCapturedAt
                ? new Date(dto.locationCapturedAt)
                : new Date(),
            }
          : undefined;
      const sessionId = randomUUID();
      const payload = {
        sub: identity.id,
        sid: sessionId,
        loginId: identity.loginId,
        username: identity.username,
        email: identity.email,
        role: identity.role.name,
      };

      const tokens = await this.jwtService.generateTokens(payload);

      await this.sessionService.create({
        id: sessionId,
        identityId: identity.id,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.refreshExpiresAt,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        device: dto.device,
        ...(location && {
          latitude: location.latitude,
          longitude: location.longitude,
          locationAccuracy: location.locationAccuracy,
          locationCapturedAt: location.locationCapturedAt,
        }),
      });

      this.updateLastLoginInBackground(
        identity.id,
        location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
            }
          : undefined,
      );

      this.queueAuditLog({
        identityId: identity.id,
        sessionId,
        loginId: identity.loginId,
        role: identity.role.name,
        service: 'AUTH',
        action: 'LOGIN_SUCCESS',
        status: 'SUCCESS',
        httpMethod: 'POST',
        endpoint: '/auth/login',
        statusCode: 200,
        ipAddress: dto.ipAddress,
        metadata: {
          loginMethod: dto.loginWith,
        },
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
          passwordChangedAt: identity.passwordChangedAt,
          preferredLoginMethod: identity.preferredLoginMethod,
        },
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof HttpException
          ? error.message
          : 'Unexpected login error';
      this.queueAuditLog({
        identityId: auditIdentity?.id,
        loginId: auditIdentity?.loginId,
        role: auditIdentity?.role.name,
        service: 'AUTH',
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        httpMethod: 'POST',
        endpoint: '/auth/login',
        statusCode,
        ipAddress: dto.ipAddress,
        metadata: {
          reason,
          loginMethod: dto.loginWith,
        },
      });
      throw error;
    }
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
    let refreshPayload: JwtPayload;

    try {
      refreshPayload = await this.jwtService.verifyRefreshToken(
        dto.refreshToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!refreshPayload.sid || !refreshPayload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.sessionService.findValidSessionById(
      refreshPayload.sid,
      refreshPayload.sub,
      dto.refreshToken,
    );

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      session.identity.status !== UserStatus.ACTIVE ||
      !session.identity.role.isActive
    ) {
      await this.sessionService.revoke(session.id);

      throw new UnauthorizedException('Session is no longer valid');
    }

    const nextPayload: JwtPayload = {
      sub: session.identity.id,
      sid: session.id,
      loginId: session.identity.loginId,
      username: session.identity.username,
      email: session.identity.email,
      role: session.identity.role.name,
      jti: randomUUID(),
    };

    const tokens = await this.jwtService.generateTokens(
      nextPayload,
      session.expiresAt,
    );

    const rotated = await this.sessionService.rotateRefreshToken(
      session.id,
      dto.refreshToken,
      tokens.refreshToken,
    );

    if (!rotated) {
      throw new UnauthorizedException(
        'Refresh token has already been used or is invalid',
      );
    }

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
    sessionId: string;
    role: string;
    currentPassword: string;
    newPassword: string;
  }) {
    let loginId: string | undefined;
    try {
      const user = await this.identityService.findById(dto.identityId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      loginId = user.loginId;

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

      const result =
        await this.identityService.changePasswordAndRevokeOtherSessions({
          identityId: dto.identityId,
          currentSessionId: dto.sessionId,
          expectedCurrentPasswordHash: user.password,
          hashedPassword,
        });

      this.queueAuditLog({
        identityId: dto.identityId,
        sessionId: dto.sessionId,
        loginId,
        role: dto.role,
        service: 'AUTH',
        action: 'PASSWORD_CHANGE_SUCCESS',
        status: 'SUCCESS',
        httpMethod: 'POST',
        endpoint: '/auth/change-password',
        statusCode: 200,
        metadata: {
          revokedOtherSessionCount: result.revokedSessionCount,
        },
      });

      return {
        success: true,
        message: 'Password changed successfully',
        revokedOtherSessionCount: result.revokedSessionCount,
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof Error
          ? error.message
          : 'Unexpected password change error';

      this.queueAuditLog({
        identityId: dto.identityId,
        sessionId: dto.sessionId,
        loginId,
        role: dto.role,
        service: 'AUTH',
        action: 'PASSWORD_CHANGE_FAILED',
        status: 'FAILED',
        httpMethod: 'POST',
        endpoint: '/auth/change-password',
        statusCode,
        metadata: {
          reason,
        },
      });
      throw error;
    }
  }

  async changeMpin(dto: {
    identityId: string;
    sessionId: string;
    role: string;
    currentMpin: string;
    newMpin: string;
  }) {
    let loginId: string | undefined;

    try {
      const user = await this.identityService.findById(dto.identityId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      loginId = user.loginId;

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

      const result =
        await this.identityService.changeMpinAndRevokeOtherSessions({
          identityId: dto.identityId,
          currentSessionId: dto.sessionId,
          expectedCurrentMpinHash: user.mpin,
          hashedMpin,
        });

      this.queueAuditLog({
        identityId: dto.identityId,
        sessionId: dto.sessionId,
        loginId,
        role: dto.role,
        service: 'AUTH',
        action: 'MPIN_CHANGE_SUCCESS',
        status: 'SUCCESS',
        httpMethod: 'POST',
        endpoint: '/auth/change-mpin',
        statusCode: 200,
        metadata: {
          revokedOtherSessionCount: result.revokedSessionCount,
        },
      });
      return {
        success: true,
        message: 'MPIN changed successfully',
        revokedOtherSessionCount: result.revokedSessionCount,
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof Error ? error.message : 'Unexpected MPIN change error';

      this.queueAuditLog({
        identityId: dto.identityId,
        sessionId: dto.sessionId,
        loginId,
        role: dto.role,
        service: 'AUTH',
        action: 'MPIN_CHANGE_FAILED',
        status: 'FAILED',
        httpMethod: 'POST',
        endpoint: '/auth/change-mpin',
        statusCode,
        metadata: {
          reason,
        },
      });

      throw error;
    }
  }

  async forgotPasswordVerifyUser(dto: VerifyForgotPasswordUserDto) {
    let auditIdentity: {
      id: string;
      loginId: string;
      role: {
        name: string;
      };
    } | null = null;

    try {
      const user = await this.identityService.findByLoginId(dto.loginId.trim());

      if (!user) {
        throw new BadRequestException('Unable to verify account details');
      }

      auditIdentity = user;

      const providedPan = dto.panNumber.trim().toUpperCase();
      const storedPan = user.panNumber.trim().toUpperCase();

      const providedAadhaarLast4 = dto.aadharLast4.trim();
      const storedAadhaarLast4 = user.aadhaarNumber.slice(-4);

      const panMatches = storedPan === providedPan;
      const aadhaarMatches = storedAadhaarLast4 === providedAadhaarLast4;

      if (!panMatches || !aadhaarMatches) {
        throw new BadRequestException('Unable to verify account details');
      }

      const otpResult = await this.otpService.sendOtp({
        type: OtpType.PHONE,
        purpose: OtpPurpose.FORGOT_PASSWORD,
        phoneNumber: user.phoneNumber,
      });

      const draft = await this.identityService.createPasswordResetDraft({
        identityId: user.id,
        expiresAt: dayjs().add(10, 'minute').toDate(),
      });

      this.queueAuditLog({
        identityId: user.id,
        loginId: user.loginId,
        role: user.role.name,
        service: 'AUTH',
        action: 'PASSWORD_RESET_REQUEST_SUCCESS',
        status: 'SUCCESS',
        httpMethod: 'POST',
        endpoint: '/auth/forgot-password/verify-user',
        statusCode: 200,
      });

      return {
        draftId: draft.id,
        nextStep: 'VERIFY_OTP',
        ...otpResult,
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof Error
          ? error.message
          : 'Unexpected password reset request error';

      this.queueAuditLog({
        identityId: auditIdentity?.id,

        loginId: auditIdentity?.loginId ?? dto.loginId.slice(0, 50),

        role: auditIdentity?.role.name,
        service: 'AUTH',
        action: 'PASSWORD_RESET_REQUEST_FAILED',
        status: 'FAILED',
        httpMethod: 'POST',
        endpoint: '/auth/forgot-password/verify-user',
        statusCode,

        metadata: {
          reason,
        },
      });

      throw error;
    }
  }

  async forgotPasswordVerifyOtp(dto: VerifyForgotPasswordOtpDto) {
    let auditIdentity: {
      id: string;
      loginId: string;
      role: {
        name: string;
      };
    } | null = null;

    try {
      const draft = await this.identityService.findPasswordResetDraft(
        dto.draftId,
      );

      if (!draft) {
        throw new NotFoundException('Password reset request not found');
      }

      auditIdentity = draft.identity;

      if (draft.expiresAt < new Date()) {
        throw new BadRequestException('Password reset request has expired');
      }

      await this.otpService.verifyOtp(
        OtpType.PHONE,
        OtpPurpose.FORGOT_PASSWORD,
        dto.otp,
        draft.identity.phoneNumber,
      );

      await this.identityService.updatePasswordRestedDraft(draft.id, {
        otpVerified: true,
      });

      this.queueAuditLog({
        identityId: draft.identity.id,
        loginId: draft.identity.loginId,
        role: draft.identity.role.name,
        service: 'AUTH',
        action: 'PASSWORD_RESET_OTP_SUCCESS',
        status: 'SUCCESS',
        httpMethod: 'POST',
        endpoint: '/auth/forgot-password/verify-otp',
        statusCode: 200,
      });

      return {
        draftId: draft.id,
        nextStep: 'RESET_PASSWORD',
        message: 'OTP verified successfully',
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof Error
          ? error.message
          : 'Unexpected OTP verification error';

      this.queueAuditLog({
        identityId: auditIdentity?.id,
        loginId: auditIdentity?.loginId,
        role: auditIdentity?.role.name,
        service: 'AUTH',
        action: 'PASSWORD_RESET_OTP_FAILED',
        status: 'FAILED',
        httpMethod: 'POST',
        endpoint: '/auth/forgot-password/verify-otp',
        statusCode,
        metadata: {
          reason,
        },
      });

      throw error;
    }
  }

  async forgotPasswordReset(dto: ResetForgotPasswordDto) {
    let auditIdentity: {
      id: string;
      loginId: string;
      role: {
        name: string;
      };
    } | null = null;

    try {
      const draft = await this.identityService.findPasswordResetDraft(
        dto.draftId,
      );

      if (!draft) {
        throw new NotFoundException('Password reset request not found');
      }

      auditIdentity = draft.identity;

      if (dto.newPassword !== dto.confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }

      if (draft.expiresAt <= new Date()) {
        throw new BadRequestException('Password reset request has expired');
      }

      if (!draft.otpVerified) {
        throw new BadRequestException('OTP verification required');
      }

      const hashedPassword = await this.passwordService.hash(dto.newPassword);

      const resetResult =
        await this.identityService.resetPasswordWithVerifiedDraft({
          draftId: draft.id,
          identityId: draft.identityId,
          hashedPassword,
        });

      this.queueAuditLog({
        identityId: draft.identity.id,
        loginId: draft.identity.loginId,
        role: draft.identity.role.name,
        service: 'AUTH',
        action: 'PASSWORD_RESET_SUCCESS',
        status: 'SUCCESS',
        httpMethod: 'POST',
        endpoint: '/auth/forgot-password/reset',
        statusCode: 200,
        metadata: {
          revokedSessionCount: resetResult.revokedSessionCount,
        },
      });

      return {
        success: true,
        message: 'Password reset successfully. Please login.',
      };
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;

      const reason =
        error instanceof Error
          ? error.message
          : 'Unexpected password reset error';

      this.queueAuditLog({
        identityId: auditIdentity?.id,
        loginId: auditIdentity?.loginId,
        role: auditIdentity?.role.name,
        service: 'AUTH',
        action: 'PASSWORD_RESET_FAILED',
        status: 'FAILED',
        httpMethod: 'POST',
        endpoint: '/auth/forgot-password/reset',
        statusCode,
        metadata: {
          reason,
        },
      });

      throw error;
    }
  }

  async resolvePeerTransferParticipants(dto: {
    senderUserId: string;
    receiverLoginId: string;
  }) {
    if (!dto.senderUserId?.trim()) {
      throw new UnauthorizedException('Invalid authenticated user');
    }

    if (!dto.receiverLoginId?.trim()) {
      throw new BadRequestException('Receiver login ID is required');
    }

    const { sender, receiver } =
      await this.identityService.findPeerTransferParticipants(
        dto.senderUserId,
        dto.receiverLoginId,
      );

    if (!sender) {
      throw new UnauthorizedException('Sender account is no longer available');
    }

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    if (sender.id === receiver.id) {
      throw new BadRequestException(
        'Sender and receiver cannot be the same user',
      );
    }

    if (sender.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Sender account is not active');
    }

    if (receiver.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Receiver account is not active');
    }

    if (!sender.role.isActive || !receiver.role.isActive) {
      throw new ForbiddenException('Sender or receiver role is inactive');
    }

    if (sender.roleId !== receiver.roleId) {
      throw new ForbiddenException(
        'Wallet transfers are allowed only between users with the same role',
      );
    }

    return {
      sender: {
        id: sender.id,
        loginId: sender.loginId,
        fullName: sender.fullName,
        role: sender.role.name,
      },

      receiver: {
        id: receiver.id,
        loginId: receiver.loginId,
        fullName: receiver.fullName,
        role: receiver.role.name,
      },
    };
  }

  async logout(dto: LogoutDto) {
    let refreshPayload: JwtPayload;

    try {
      refreshPayload = await this.jwtService.verifyRefreshToken(
        dto.refreshToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!refreshPayload.sid || !refreshPayload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.sessionService.findValidSessionById(
      refreshPayload.sid,
      refreshPayload.sub,
      dto.refreshToken,
    );

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.sessionService.revoke(session.id);

    this.queueAuditLog({
      identityId: session.identity.id,
      sessionId: session.id,
      loginId: session.identity.loginId,
      role: session.identity.role.name,
      service: 'AUTH',
      action: 'LOGOUT_SUCCESS',
      status: 'SUCCESS',
      httpMethod: 'POST',
      endpoint: '/auth/logout',
      statusCode: 200,
      metadata: {
        revokedSessionId: session.id,
      },
    });

    return {
      message: 'Logged out successfully',
    };
  }

  private async publishAuditLog(
    data: Omit<CreateAuditLogDto, 'eventId'>,
  ): Promise<void> {
    try {
      await this.kafkaProducer.publish(AUDIT_PATTERNS.CREATE_LOG, {
        eventId: randomUUID(),
        ...data,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown audit publishing error';

      this.logger.error(
        `Failed to publish authentication audit log: ${message}`,
      );
    }
  }

  private getPositiveLoginConfig(key: string, fallback: number): number {
    const configuredValue = Number(
      this.configService.get<number | string>(key) ?? fallback,
    );
    if (!Number.isInteger(configuredValue) || configuredValue <= 0) {
      this.logger.warn(
        `Invalid login configuration for ${key}. Using ${fallback}.`,
      );
      return fallback;
    }
    return configuredValue;
  }

  private getLoginRateLimitKeys(
    dto: Pick<LoginKafkaDto, 'identifier' | 'ipAddress'>,
  ): {
    identifierAttempts: string;
    identifierLock: string;
    ipAttempts?: string;
    ipLock?: string;
  } {
    const identifier = dto.identifier.trim().toLowerCase();
    const identifierHash = createHash('sha256')
      .update(identifier)
      .digest('hex');
    const ipAddress = dto.ipAddress?.trim();
    const ipHash = ipAddress
      ? createHash('sha256').update(ipAddress).digest('hex')
      : undefined;
    return {
      identifierAttempts: `auth:login:attempts:identifier:${identifierHash}`,
      identifierLock: `auth:login:lock:identifier:${identifierHash}`,
      ...(ipHash && {
        ipAttempts: `auth:login:attempts:ip:${ipHash}`,
        ipLock: `auth:login:lock:ip:${ipHash}`,
      }),
    };
  }

  private createLoginRateLimitException(
    remainingSeconds: number,
  ): HttpException {
    const seconds = Math.max(1, remainingSeconds);

    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Too many failed login attempts. Please try again in ${seconds} seconds.`,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async checkLoginRateLimit(
    dto: Pick<LoginKafkaDto, 'identifier' | 'ipAddress'>,
  ): Promise<void> {
    const keys = this.getLoginRateLimitKeys(dto);

    try {
      const [identifierLockTtl, ipLockTtl] = await Promise.all([
        this.cache.ttl(keys.identifierLock),

        keys.ipLock ? this.cache.ttl(keys.ipLock) : Promise.resolve(-2),
      ]);

      if (identifierLockTtl > 0 || ipLockTtl > 0) {
        throw this.createLoginRateLimitException(
          Math.max(identifierLockTtl, ipLockTtl),
        );
      }

      if (identifierLockTtl === -1 || ipLockTtl === -1) {
        const lockSeconds = this.getPositiveLoginConfig(
          'AUTH_LOGIN_LOCK_SECONDS',
          900,
        );

        throw this.createLoginRateLimitException(lockSeconds);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown login rate-limit error';

      this.logger.error(`Unable to check login rate limit: ${message}`);

      throw new ServiceUnavailableException(
        'Login service is temporarily unavailable',
      );
    }
  }

  private async recordFailedLoginAttempt(
    dto: Pick<LoginKafkaDto, 'identifier' | 'ipAddress'>,
  ): Promise<void> {
    const keys = this.getLoginRateLimitKeys(dto);

    const maxIdentifierAttempts = this.getPositiveLoginConfig(
      'AUTH_LOGIN_MAX_ATTEMPTS',
      5,
    );

    const maxIpAttempts = this.getPositiveLoginConfig(
      'AUTH_LOGIN_IP_MAX_ATTEMPTS',
      30,
    );

    const attemptsWindowSeconds = this.getPositiveLoginConfig(
      'AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS',
      900,
    );

    const lockSeconds = this.getPositiveLoginConfig(
      'AUTH_LOGIN_LOCK_SECONDS',
      900,
    );

    try {
      const [identifierAttempts, ipAttempts] = await Promise.all([
        this.cache.incrementWithExpiry(
          keys.identifierAttempts,
          attemptsWindowSeconds,
        ),

        keys.ipAttempts
          ? this.cache.incrementWithExpiry(
              keys.ipAttempts,
              attemptsWindowSeconds,
            )
          : Promise.resolve(0),
      ]);

      const shouldLockIdentifier = identifierAttempts >= maxIdentifierAttempts;

      const shouldLockIp = Boolean(keys.ipLock) && ipAttempts >= maxIpAttempts;

      if (!shouldLockIdentifier && !shouldLockIp) {
        return;
      }

      await Promise.all([
        shouldLockIdentifier
          ? this.cache.setIfNotExists(
              keys.identifierLock,
              'locked',
              lockSeconds,
            )
          : Promise.resolve(false),

        shouldLockIp && keys.ipLock
          ? this.cache.setIfNotExists(keys.ipLock, 'locked', lockSeconds)
          : Promise.resolve(false),
      ]);

      throw this.createLoginRateLimitException(lockSeconds);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown failed-login tracking error';

      this.logger.error(`Unable to record failed login attempt: ${message}`);

      throw new ServiceUnavailableException(
        'Login service is temporarily unavailable',
      );
    }
  }

  private async clearLoginAttempts(
    dto: Pick<LoginKafkaDto, 'identifier' | 'ipAddress'>,
  ): Promise<void> {
    const keys = this.getLoginRateLimitKeys(dto);

    try {
      await this.cache.del(keys.identifierAttempts, keys.identifierLock);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown login attempt cleanup error';

      this.logger.error(`Unable to clear login attempts: ${message}`);

      throw new ServiceUnavailableException(
        'Login service is temporarily unavailable',
      );
    }
  }

  private updateLastLoginInBackground(
    identityId: string,
    location?: {
      latitude: number;
      longitude: number;
    },
  ): void {
    void this.identityService
      .updateLastLogin(identityId, location)
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown last-login update error';

        this.logger.error(
          `Failed to update last login for identity ${identityId}: ${message}`,
        );
      });
  }

  async resolveCommissionRecipientEligibility(dto: {
    identityId: string;
    expectedRole: string;
  }) {
    const expectedRole = dto.expectedRole
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    const identity =
      await this.identityService.findCommissionRecipientEligibility(
        dto.identityId,
      );

    if (!identity) {
      return {
        identityId: dto.identityId,
        eligible: false,
        reason: 'IDENTITY_NOT_FOUND',
      };
    }

    if (identity.status !== UserStatus.ACTIVE) {
      return {
        identityId: identity.id,
        eligible: false,
        status: identity.status,
        role: identity.role.name,
        reason: 'IDENTITY_NOT_ACTIVE',
      };
    }

    if (!identity.role.isActive) {
      return {
        identityId: identity.id,
        eligible: false,
        status: identity.status,
        role: identity.role.name,
        reason: 'ROLE_NOT_ACTIVE',
      };
    }

    /*
     * Hierarchy bol rahi DISTRIBUTOR,
     * lekin actual auth account ka role
     * bhi DISTRIBUTOR hi hona chahiye.
     */
    if (identity.role.name !== expectedRole) {
      return {
        identityId: identity.id,
        eligible: false,
        status: identity.status,
        role: identity.role.name,
        expectedRole,
        reason: 'ROLE_MISMATCH',
      };
    }

    return {
      identityId: identity.id,
      eligible: true,
      status: identity.status,
      role: identity.role.name,
      reason: null,
    };
  }
}
