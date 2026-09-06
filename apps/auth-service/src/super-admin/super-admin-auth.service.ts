import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SuperAdminRepository } from './repository/super-admin.repository';
import { SuperAdminSessionService } from './super-admin-session.service';
import { PasswordService } from './../auth/password/password.service';
import { JwtService } from '../auth/jwt/jwt.service';
import { LoginKafkaDto } from '@nexus/common/auth/dto/login-kafka.dto';
import {
  AccountOnboardingStatus,
  OtpPurpose,
  OtpType,
  UserStatus,
} from 'apps/auth-service/generated/prisma/enums';
import { randomUUID } from 'crypto';
import { JwtPayload } from '../auth/jwt/interfaces/jwt-payload.interface';
import { IdentityService } from '../identity/identity.service';
import { OtpService } from '../otp/otp.service';
import {
  CreateAdminAccountDto,
  SuperAdminSendPhoneOtpDto,
  SuperAdminVerifyPhoneOtpDto,
} from '@nexus/common';
import { SuperAdminPanOnboardingDto } from '@nexus/common/auth/dto/super-admin/super-admin-pan-onboarding.dto';
import { ConfigService } from '@nestjs/config';
import {
  AuthNotificationEvent,
  KAFKA_TOPICS,
  KafkaProducerService,
} from 'libs/kafka/src';
import { generatePassword } from '../auth/utils/password-generator';
import { generateMpin } from '../auth/utils/mpin-generator';
import { RoleService } from '../role/role.service';
import { TrustedDeviceService } from '../auth/device/trusted-device.service';
import { VerifyDeviceLoginDto } from '@nexus/common/auth/dto/verify-device-login.dto';

@Injectable()
export class SuperAdminAuthService {
  private readonly logger = new Logger(SuperAdminAuthService.name);
  constructor(
    private readonly superAdminRepository: SuperAdminRepository,
    private readonly superAdminSessionService: SuperAdminSessionService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly identityService: IdentityService,
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly roleService: RoleService,
    private readonly trustedDeviceService: TrustedDeviceService,
  ) {}

  async login(dto: LoginKafkaDto) {
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

    const superAdmin = await this.superAdminRepository.findByIdentifier(
      dto.identifier,
    );

    if (!superAdmin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (superAdmin.role.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Invalid Super Admin account');
    }

    if (superAdmin.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        `Account is ${superAdmin.status.toLowerCase()}`,
      );
    }

    if (!superAdmin.role.isActive) {
      throw new ForbiddenException('Super Admin role is inactive');
    }

    const isOnboardingCompleted =
      superAdmin.onboardingStatus === AccountOnboardingStatus.COMPLETED;

    if (
      !isOnboardingCompleted &&
      superAdmin.temporaryCredentialsExpireAt &&
      superAdmin.temporaryCredentialsExpireAt <= new Date()
    ) {
      throw new ForbiddenException(
        'Temporary credentials have expired. Contact the primary Super Admin.',
      );
    }

    const credentialHash =
      dto.loginWith === 'PASSWORD' ? superAdmin.password : superAdmin.mpin;

    const credentialIsValid = await this.passwordService.verify(
      credentialHash,
      dto.password,
    );

    if (!credentialIsValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const deviceId = dto.deviceId.trim();

    const isTrustedDevice =
      await this.trustedDeviceService.isSuperAdminDeviceTrusted(
        superAdmin.id,
        deviceId,
      );

    if (!isTrustedDevice) {
      const challenge =
        await this.trustedDeviceService.createSuperAdminLoginChallenge({
          superAdminId: superAdmin.id,
          deviceId,
          deviceName: dto.device,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        });

      await this.otpService.sendOtp({
        type: OtpType.EMAIL,
        purpose: OtpPurpose.NEW_DEVICE_LOGIN,
        email: superAdmin.email,
      });

      return {
        requiresDeviceVerification: true,
        challengeId: challenge.id,
        maskedEmail: this.maskEmail(superAdmin.email),
        expiresAt: challenge.expiresAt,
        message: 'New device detected. Verification OTP sent to your email.',
      };
    }

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

    const jwtPayload: JwtPayload = {
      sub: superAdmin.id,
      sid: sessionId,
      accountType: 'SUPER_ADMIN',
      loginId: superAdmin.loginId,
      username: superAdmin.username,
      email: superAdmin.email,
      role: superAdmin.role.name,
    };
    const tokens = await this.jwtService.generateTokens(jwtPayload);

    await this.superAdminSessionService.create({
      id: sessionId,
      superAdminId: superAdmin.id,
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

    void this.superAdminRepository
      .updateLastLogin(
        superAdmin.id,
        location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
            }
          : undefined,
      )
      .catch(() => undefined);

    const onboardingRequired =
      superAdmin.onboardingStatus !== AccountOnboardingStatus.COMPLETED;
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
      onboardingRequired,
      ...(onboardingRequired && {
        onboardingStatus: superAdmin.onboardingStatus,
        nextStep: this.getNextOnboardingStep(
          superAdmin.onboardingStatus,
          superAdmin.isPhoneVerified,
          superAdmin.panNumber,
          superAdmin.passwordChangedAt,
          superAdmin.mpinChangedAt,
        ),
      }),

      superAdmin: {
        id: superAdmin.id,
        loginId: superAdmin.loginId,
        fullName: superAdmin.fullName,
        username: superAdmin.username,
        email: superAdmin.email,
        phoneNumber: superAdmin.phoneNumber,
        role: superAdmin.role.name,
        status: superAdmin.status,
        isPrimary: superAdmin.isPrimary,
        isPhoneVerified: superAdmin.isPhoneVerified,
        isPanVerified: superAdmin.isPanVerified,
        onboardingStatus: superAdmin.onboardingStatus,
        passwordChangedAt: superAdmin.passwordChangedAt,
        mpinChangedAt: superAdmin.mpinChangedAt,
        preferredLoginMethod: superAdmin.preferredLoginMethod,
      },
    };
  }

  async changePassword(
    superAdminId: string,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const superAdmin = await this.superAdminRepository.findById(superAdminId);

    if (!superAdmin) {
      throw new NotFoundException('Super Admin not found');
    }

    if (!superAdmin.isPhoneVerified) {
      throw new ForbiddenException('Complete phone verification first');
    }

    if (!superAdmin.panNumber) {
      throw new ForbiddenException('Add PAN number first');
    }

    if (
      superAdmin.onboardingStatus !==
      AccountOnboardingStatus.CREDENTIAL_CHANGE_REQUIRED
    ) {
      throw new BadRequestException(
        'Password change is not available at the current onboarding stage',
      );
    }

    const currentPasswordIsValid = await this.passwordService.verify(
      superAdmin.password,
      currentPassword,
    );

    if (!currentPasswordIsValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const hashedPassword = await this.passwordService.hash(newPassword);

    const result =
      await this.superAdminRepository.changePasswordAndRevokeOtherSessions({
        superAdminId,
        currentSessionId,
        expectedPasswordHash: superAdmin.password,
        hashedPassword,
      });

    if (!result.updated) {
      throw new ConflictException(
        'Password was changed by another request. Please try again.',
      );
    }

    return {
      success: true,
      message: 'Password changed successfully',
      onboardingRequired: true,
      nextStep: 'CHANGE_MPIN',
      revokedOtherSessionCount: result.revokedSessionCount,
    };
  }

  async changeMpin(
    superAdminId: string,
    currentSessionId: string,
    currentMpin: string,
    newMpin: string,
  ) {
    const superAdmin = await this.superAdminRepository.findById(superAdminId);

    if (!superAdmin) {
      throw new NotFoundException('Super Admin not found');
    }

    if (!superAdmin.isPhoneVerified) {
      throw new ForbiddenException('Complete phone verification first');
    }

    if (!superAdmin.panNumber) {
      throw new ForbiddenException('Add PAN number first');
    }

    if (!superAdmin.passwordChangedAt) {
      throw new ForbiddenException('Change the temporary password first');
    }

    if (
      superAdmin.onboardingStatus !==
      AccountOnboardingStatus.CREDENTIAL_CHANGE_REQUIRED
    ) {
      throw new BadRequestException(
        'MPIN change is not available at the current onboarding stage',
      );
    }

    const currentMpinIsValid = await this.passwordService.verify(
      superAdmin.mpin,
      currentMpin,
    );

    if (!currentMpinIsValid) {
      throw new BadRequestException('Current MPIN is incorrect');
    }

    if (currentMpin === newMpin) {
      throw new BadRequestException(
        'New MPIN must be different from the current MPIN',
      );
    }

    const hashedMpin = await this.passwordService.hash(newMpin);

    const result =
      await this.superAdminRepository.changeMpinAndCompleteOnboarding({
        superAdminId,
        currentSessionId,
        expectedMpinHash: superAdmin.mpin,
        hashedMpin,
      });

    if (!result.updated) {
      throw new ConflictException(
        'MPIN was changed by another request. Please try again.',
      );
    }

    return {
      success: true,
      message: 'MPIN changed and onboarding completed successfully',
      onboardingRequired: false,
      nextStep: null,
      revokedOtherSessionCount: result.revokedSessionCount,
    };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired Super Admin refresh token',
      );
    }

    if (
      !payload.sub ||
      !payload.sid ||
      payload.accountType !== 'SUPER_ADMIN' ||
      payload.role !== 'SUPER_ADMIN'
    ) {
      throw new UnauthorizedException('Invalid Super Admin refresh token');
    }

    const session = await this.superAdminSessionService.findValidSessionById(
      payload.sid,
      payload.sub,
      refreshToken,
    );

    if (!session) {
      throw new UnauthorizedException('Invalid or expired Super Admin session');
    }

    const superAdmin = session.superAdmin;

    if (
      superAdmin.status !== UserStatus.ACTIVE ||
      !superAdmin.role.isActive ||
      superAdmin.role.name !== 'SUPER_ADMIN'
    ) {
      await this.superAdminSessionService.revoke(session.id);

      throw new UnauthorizedException('Super Admin session is no longer valid');
    }

    const nextPayload: JwtPayload = {
      sub: superAdmin.id,
      sid: session.id,
      accountType: 'SUPER_ADMIN',
      loginId: superAdmin.loginId,
      username: superAdmin.username,
      email: superAdmin.email,
      role: superAdmin.role.name,
      jti: randomUUID(),
    };

    const tokens = await this.jwtService.generateTokens(
      nextPayload,
      session.expiresAt,
    );

    const rotated = await this.superAdminSessionService.rotateRefreshToken(
      session.id,
      refreshToken,
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
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }

  async logout(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired Super Admin refresh token',
      );
    }

    if (
      !payload.sub ||
      !payload.sid ||
      payload.accountType !== 'SUPER_ADMIN' ||
      payload.role !== 'SUPER_ADMIN'
    ) {
      throw new UnauthorizedException('Invalid Super Admin refresh token');
    }

    const session = await this.superAdminSessionService.findValidSessionById(
      payload.sid,
      payload.sub,
      refreshToken,
    );

    if (!session) {
      throw new UnauthorizedException('Super Admin session is no longer valid');
    }

    await this.superAdminSessionService.revoke(session.id);

    return {
      success: true,
      message: 'Super Admin logged out successfully',
    };
  }

  async sendPhoneOnboardingOtp(
    superAdminId: string,
    dto: SuperAdminSendPhoneOtpDto,
  ) {
    const superAdmin = await this.superAdminRepository.findById(superAdminId);

    if (!superAdmin) {
      throw new NotFoundException('Super Admin account not found');
    }

    if (superAdmin.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Super Admin account is not active');
    }

    if (superAdmin.onboardingStatus === AccountOnboardingStatus.COMPLETED) {
      throw new ConflictException(
        'Super Admin onboarding has already been completed',
      );
    }

    if (superAdmin.isPhoneVerified) {
      throw new ConflictException(
        'Super Admin phone number is already verified',
      );
    }

    const phoneNumber = dto.phoneNumber.trim();

    const [existingIdentity, existingSuperAdmin] = await Promise.all([
      this.identityService.findByPhoneNumber(phoneNumber),
      this.superAdminRepository.findByPhoneNumber(phoneNumber),
    ]);

    if (existingIdentity) {
      throw new ConflictException(
        'Phone number is already registered with another account',
      );
    }

    if (existingSuperAdmin && existingSuperAdmin.id !== superAdmin.id) {
      throw new ConflictException(
        'Phone number is already registered with another Super Admin',
      );
    }

    await this.superAdminRepository.update(superAdmin.id, {
      phoneNumber,
      isPhoneVerified: false,
      onboardingStatus: AccountOnboardingStatus.PHONE_PENDING,
    });

    const otpResult = await this.otpService.sendOtp({
      type: OtpType.PHONE,
      purpose: OtpPurpose.ACCOUNT_ONBOARDING,
      phoneNumber,
    });

    return {
      ...otpResult,
      onboardingStatus: AccountOnboardingStatus.PHONE_PENDING,
      nextStep: 'VERIFY_PHONE_OTP',
    };
  }

  async verifyPhoneOnboardingOtp(
    superAdminId: string,
    dto: SuperAdminVerifyPhoneOtpDto,
  ) {
    const superAdmin = await this.superAdminRepository.findById(superAdminId);

    if (!superAdmin) {
      throw new NotFoundException('Super Admin account not found');
    }

    if (superAdmin.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Super Admin account is not active');
    }

    if (superAdmin.onboardingStatus === AccountOnboardingStatus.COMPLETED) {
      throw new ConflictException(
        'Super Admin onboarding has already been completed',
      );
    }

    if (superAdmin.isPhoneVerified) {
      throw new ConflictException(
        'Super Admin phone number is already verified',
      );
    }

    if (!superAdmin.phoneNumber) {
      throw new BadRequestException('Add a phone number before verifying OTP');
    }

    if (superAdmin.onboardingStatus !== AccountOnboardingStatus.PHONE_PENDING) {
      throw new BadRequestException('Phone OTP has not been requested');
    }

    await this.otpService.verifyOtp(
      OtpType.PHONE,
      OtpPurpose.ACCOUNT_ONBOARDING,
      dto.otp,
      superAdmin.phoneNumber,
    );

    await this.superAdminRepository.update(superAdmin.id, {
      isPhoneVerified: true,
      onboardingStatus: AccountOnboardingStatus.PAN_PENDING,
    });

    return {
      success: true,
      message: 'Phone number verified successfully',
      onboardingStatus: AccountOnboardingStatus.PAN_PENDING,
      nextStep: 'ADD_PAN',
    };
  }

  async addPanForOnboarding(
    superAdminId: string,
    dto: SuperAdminPanOnboardingDto,
  ) {
    const superAdmin = await this.superAdminRepository.findById(superAdminId);

    if (!superAdmin) {
      throw new NotFoundException('Super Admin account not found');
    }

    if (superAdmin.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Super Admin account is not active');
    }

    if (superAdmin.onboardingStatus === AccountOnboardingStatus.COMPLETED) {
      throw new ConflictException(
        'Super Admin onboarding has already been completed',
      );
    }

    if (!superAdmin.isPhoneVerified) {
      throw new ForbiddenException(
        'Verify your phone number before adding PAN',
      );
    }

    if (superAdmin.onboardingStatus !== AccountOnboardingStatus.PAN_PENDING) {
      throw new BadRequestException(
        'PAN onboarding is not currently available',
      );
    }

    const panNumber = dto.panNumber.trim().toUpperCase();

    const [existingIdentity, existingSuperAdmin] = await Promise.all([
      this.identityService.findByPanNumber(panNumber),
      this.superAdminRepository.findByPanNumber(panNumber),
    ]);

    if (existingIdentity) {
      throw new ConflictException(
        'PAN number is already registered with another account',
      );
    }

    if (existingSuperAdmin && existingSuperAdmin.id !== superAdmin.id) {
      throw new ConflictException(
        'PAN number is already registered with another Super Admin',
      );
    }

    await this.superAdminRepository.update(superAdmin.id, {
      panNumber,

      // PAN has only been provided and format-validated.
      // A real provider has not verified it yet.
      isPanVerified: false,

      onboardingStatus: AccountOnboardingStatus.CREDENTIAL_CHANGE_REQUIRED,
    });

    return {
      success: true,
      message: 'PAN number added successfully',
      panVerificationStatus: 'NOT_VERIFIED',
      onboardingStatus: AccountOnboardingStatus.CREDENTIAL_CHANGE_REQUIRED,
      nextStep: 'CHANGE_PASSWORD',
    };
  }

  async createIdentityAccount(
    creatorIdentityId: string,
    dto: CreateAdminAccountDto,
  ) {
    const [superAdminCreator, identityCreator] = await Promise.all([
      this.superAdminRepository.findById(creatorIdentityId),
      this.identityService.findByIdWithRole(creatorIdentityId),
    ]);

    const creator = superAdminCreator ?? identityCreator;

    if (!creator) {
      throw new UnauthorizedException('Creator account not found');
    }

    if (creator.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Creator account is not active');
    }

    if (!creator.role.isActive) {
      throw new ForbiddenException('Creator role is inactive');
    }

    if (creator.onboardingStatus !== AccountOnboardingStatus.COMPLETED) {
      throw new ForbiddenException(
        'Complete account onboarding before creating accounts',
      );
    }

    const roleName = dto.role.trim().toUpperCase().replace(/\s+/g, '_');

    await this.roleService.assertCanRegisterRole(creator.roleId, roleName);

    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim().toLowerCase();

    const [
      identityWithEmail,
      identityWithUsername,
      superAdminWithEmail,
      superAdminWithUsername,
    ] = await Promise.all([
      this.identityService.findByEmail(normalizedEmail),
      this.identityService.findByUsername(normalizedUsername),
      this.superAdminRepository.findByEmail(normalizedEmail),
      this.superAdminRepository.findByUsername(normalizedUsername),
    ]);

    if (identityWithEmail || superAdminWithEmail) {
      throw new ConflictException('Email is already registered');
    }

    if (identityWithUsername || superAdminWithUsername) {
      throw new ConflictException('Username is already registered');
    }

    const temporaryPassword = generatePassword();
    const temporaryMpin = generateMpin();

    const [hashedPassword, hashedMpin] = await Promise.all([
      this.passwordService.hash(temporaryPassword),
      this.passwordService.hash(temporaryMpin),
    ]);

    const configuredExpiryHours = Number(
      this.configService.get<string | number>(
        'SUPER_ADMIN_CREATED_ACCOUNT_CREDENTIAL_EXPIRY_HOURS',
      ) ?? 24,
    );

    const expiryHours =
      Number.isInteger(configuredExpiryHours) && configuredExpiryHours > 0
        ? configuredExpiryHours
        : 24;

    const temporaryCredentialsExpireAt = new Date(
      Date.now() + expiryHours * 60 * 60 * 1000,
    );
    let account;

    if (roleName === 'SUPER_ADMIN') {
      if (!superAdminCreator) {
        throw new ForbiddenException(
          'Only a Super Admin account can create another Super Admin',
        );
      }

      account = await this.superAdminRepository.createManagedSuperAdmin({
        creatorSuperAdminId: superAdminCreator.id,
        fullName: dto.fullName,
        username: normalizedUsername,
        email: normalizedEmail,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        shopName: dto.shopName,
        shopAddress: dto.shopAddress,
        shopCity: dto.shopCity,
        shopState: dto.shopState,
        hashedPassword,
        hashedMpin,
        temporaryCredentialsExpireAt,
      });
    } else {
      account = await this.identityService.createAdminManagedIdentity({
        ...(superAdminCreator
          ? {
              createdBySuperAdminId: superAdminCreator.id,
            }
          : {
              createdByIdentityId: identityCreator!.id,
            }),

        roleName,
        fullName: dto.fullName,
        username: normalizedUsername,
        email: normalizedEmail,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        shopName: dto.shopName,
        shopAddress: dto.shopAddress,
        shopCity: dto.shopCity,
        shopState: dto.shopState,
        hashedPassword,
        hashedMpin,
        temporaryCredentialsExpireAt,
      });
    }

    const credentialEvent: AuthNotificationEvent = {
      eventId: `admin-created-credentials-${account.id}-${randomUUID()}`,
      identityId: account.id,
      email: account.email,
      occurredAt: new Date().toISOString(),
      data: {
        fullName: account.fullName,
        loginId: account.loginId,
        temporaryPassword,
        temporaryMpin,
        role: account.role.name,
        accountType: roleName === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'IDENTITY',
        expiresAt: temporaryCredentialsExpireAt.toISOString(),
      },
    };

    let credentialsEmailQueued = false;

    try {
      await this.kafkaProducer.publish(
        KAFKA_TOPICS.AUTH_CREDENTIALS_ISSED,
        credentialEvent,
      );

      credentialsEmailQueued = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown credential email error';

      this.logger.error(
        `Account ${account.id} was created, but credential email could not be queued: ${message}`,
      );
    }

    return {
      success: true,

      message: credentialsEmailQueued
        ? 'Account created successfully. Temporary credentials were sent by email.'
        : 'Account created successfully, but the credentials email could not be queued.',

      account: {
        id: account.id,
        accountType: roleName === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'IDENTITY',
        loginId: account.loginId,
        fullName: account.fullName,
        username: account.username,
        email: account.email,
        role: account.role.name,
        onboardingStatus: account.onboardingStatus,
        temporaryCredentialsExpireAt: account.temporaryCredentialsExpireAt,
      },

      credentialsEmailQueued,
    };
  }

  async verifyDeviceLogin(dto: VerifyDeviceLoginDto) {
    const challenge = await this.trustedDeviceService.findValidChallenge(
      dto.challengeId,
    );

    if (!challenge.superAdminId) {
      throw new UnauthorizedException(
        'Invalid Super Admin device verification challenge',
      );
    }

    const superAdmin = await this.superAdminRepository.findById(
      challenge.superAdminId,
    );

    if (!superAdmin) {
      throw new UnauthorizedException('Super Admin account not found');
    }

    if (superAdmin.role.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Invalid Super Admin account');
    }

    if (superAdmin.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Super Admin account is not active');
    }

    if (!superAdmin.role.isActive) {
      throw new ForbiddenException('Super Admin role is inactive');
    }

    if (challenge.attempts >= 5) {
      throw new UnauthorizedException('Too many device verification attempts');
    }

    try {
      await this.otpService.verifyOtp(
        OtpType.EMAIL,
        OtpPurpose.NEW_DEVICE_LOGIN,
        dto.otp,
        undefined,
        superAdmin.email,
      );
    } catch (error) {
      await this.trustedDeviceService.incrementChallengeAttempts(challenge.id);

      throw error;
    }

    const trustedDevice = await this.trustedDeviceService.trustSuperAdminDevice(
      {
        superAdminId: superAdmin.id,
        deviceId: challenge.deviceId,
        deviceName: challenge.deviceName ?? undefined,
        ipAddress: challenge.ipAddress ?? undefined,
        userAgent: challenge.userAgent ?? undefined,
      },
    );

    const sessionId = randomUUID();

    const jwtPayload: JwtPayload = {
      sub: superAdmin.id,
      sid: sessionId,
      accountType: 'SUPER_ADMIN',
      loginId: superAdmin.loginId,
      username: superAdmin.username,
      email: superAdmin.email,
      role: superAdmin.role.name,
    };

    const tokens = await this.jwtService.generateTokens(jwtPayload);

    await this.superAdminSessionService.create({
      id: sessionId,
      superAdminId: superAdmin.id,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.refreshExpiresAt,

      ipAddress: challenge.ipAddress ?? undefined,

      userAgent: challenge.userAgent ?? undefined,

      device: challenge.deviceName ?? undefined,
    });

    /*
     * Important:
     * consume the challenge only AFTER
     * trust + session creation succeeds.
     */
    await this.trustedDeviceService.markChallengeVerified(challenge.id);

    void this.superAdminRepository
      .updateLastLogin(superAdmin.id)
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown last-login update error';

        this.logger.error(
          `Failed to update Super Admin last login: ${message}`,
        );
      });

    const onboardingRequired =
      superAdmin.onboardingStatus !== AccountOnboardingStatus.COMPLETED;

    return {
      success: true,

      accountType: 'SUPER_ADMIN',

      requiresDeviceVerification: false,

      accessToken: tokens.accessToken,

      refreshToken: tokens.refreshToken,

      refreshExpiresAt: tokens.refreshExpiresAt,

      trustedDevice: {
        deviceId: trustedDevice.deviceId,
        trustedUntil: trustedDevice.trustedUntil,
      },

      onboardingRequired,

      ...(onboardingRequired && {
        onboardingStatus: superAdmin.onboardingStatus,

        nextStep: this.getNextOnboardingStep(
          superAdmin.onboardingStatus,
          superAdmin.isPhoneVerified,
          superAdmin.panNumber,
          superAdmin.passwordChangedAt,
          superAdmin.mpinChangedAt,
        ),
      }),

      superAdmin: {
        id: superAdmin.id,
        loginId: superAdmin.loginId,
        fullName: superAdmin.fullName,
        username: superAdmin.username,
        email: superAdmin.email,
        phoneNumber: superAdmin.phoneNumber,

        role: superAdmin.role.name,
        status: superAdmin.status,

        isPrimary: superAdmin.isPrimary,

        isPhoneVerified: superAdmin.isPhoneVerified,

        isPanVerified: superAdmin.isPanVerified,

        onboardingStatus: superAdmin.onboardingStatus,

        passwordChangedAt: superAdmin.passwordChangedAt,

        mpinChangedAt: superAdmin.mpinChangedAt,

        preferredLoginMethod: superAdmin.preferredLoginMethod,
      },
    };
  }

  private getNextOnboardingStep(
    onboardingStatus: AccountOnboardingStatus,
    isPhoneVerified: boolean,
    panNumber: string | null,
    passwordChangedAt: Date | null,
    mpinChangedAt: Date | null,
  ): string | null {
    if (onboardingStatus === AccountOnboardingStatus.COMPLETED) {
      return null;
    }
    if (!isPhoneVerified) {
      return 'ADD_AND_VERIFY_PHONE';
    }

    if (!panNumber) {
      return 'ADD_PAN';
    }

    if (!passwordChangedAt) {
      return 'CHANGE_PASSWORD';
    }

    if (!mpinChangedAt) {
      return 'CHANGE_MPIN';
    }

    return 'COMPLETE_ONBOARDING';
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');

    if (!localPart || !domain) {
      return '***';
    }

    if (localPart.length <= 2) {
      return `${localPart[0] ?? '*'}***@${domain}`;
    }

    return `${localPart[0]}${'*'.repeat(
      Math.min(localPart.length - 2, 5),
    )}${localPart[localPart.length - 1]}@${domain}`;
  }
}
