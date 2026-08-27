import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { OtpRepository } from './repository/otp.repository';
import { randomInt, randomUUID } from 'crypto';
import { IdentityService } from './../identity/identity.service';
import { OtpPurpose, OtpType } from '../../generated/prisma/enums';
import { SendOtpDto } from './dto/send-otp.dto';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'libs/cache/src';
import { KAFKA_TOPICS, KafkaProducerService } from 'libs/kafka/src';

interface CachedOtp {
  otpId?: string;
  otpHash: string;
  expiresAt: string;
  attempts?: number;
}

class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly identityService: IdentityService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private async hashOtp(otp: string): Promise<string> {
    return argon2.hash(otp);
  }

  private async verifyHash(hash: string, otp: string): Promise<boolean> {
    return argon2.verify(hash, otp);
  }

  private getIdentifier(
    type: OtpType,
    phoneNumber?: string,
    email?: string,
  ): string {
    const identifier =
      type === OtpType.PHONE ? phoneNumber?.trim() : email?.trim();

    if (!identifier) {
      throw new BadRequestException(
        type === OtpType.PHONE
          ? 'Phone number is required'
          : 'Email is required',
      );
    }
    return identifier;
  }

  private getOtpCacheKey(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): string {
    const identifier = this.getIdentifier(type, phoneNumber, email);
    return `otp:${type}:${purpose}:${identifier}`;
  }

  private getOtpAttemptsKey(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): string {
    const identifier = this.getIdentifier(type, phoneNumber, email);

    return `otp:attempts:${type}:${purpose}:${identifier}`;
  }

  private getOtpCooldownKey(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): string {
    const identifier = this.getIdentifier(type, phoneNumber, email);

    return `otp:cooldown:${type}:${purpose}:${identifier}`;
  }

  private getVerificationLockKey(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): string {
    const identifier = this.getIdentifier(type, phoneNumber, email);

    return `otp:verify-lock:${type}:${purpose}:${identifier}`;
  }
  private getPositiveInteger(configKey: string, fallback: number): number {
    const configuredValue = Number(
      this.configService.get<number | string>(configKey) ?? fallback,
    );

    if (!Number.isInteger(configuredValue) || configuredValue <= 0) {
      this.logger.warn(
        `Invalid configuration for ${configKey}. Using ${fallback}.`,
      );
      return fallback;
    }
    return configuredValue;
  }

  private getRemainingTtl(expiresAt: string | Date): number {
    const expiryTime =
      expiresAt instanceof Date
        ? expiresAt.getTime()
        : new Date(expiresAt).getTime();

    return Math.max(1, Math.ceil((expiryTime - Date.now()) / 1000));
  }

  private async cacheOtp(
    type: OtpType,
    purpose: OtpPurpose,
    otpId: string,
    otpHash: string,
    expiresAt: Date,
    phoneNumber?: string,
    email?: string,
  ): Promise<void> {
    const key = this.getOtpCacheKey(type, purpose, phoneNumber, email);
    await this.cacheService.set(
      key,
      {
        otpId,
        otpHash,
        attempts: 0,
        expiresAt: expiresAt.toISOString(),
      } satisfies CachedOtp,
      this.getRemainingTtl(expiresAt),
    );
  }

  private async getCacheOtp(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): Promise<CachedOtp | null> {
    const key = this.getOtpCacheKey(type, purpose, phoneNumber, email);
    return this.cacheService.get(key);
  }

  private async deleteOtpState(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): Promise<void> {
    const otpKey = this.getOtpCacheKey(type, purpose, phoneNumber, email);
    const attemptsKey = this.getOtpAttemptsKey(
      type,
      purpose,
      phoneNumber,
      email,
    );
    await this.cacheService.del(otpKey, attemptsKey);
  }

  async sendOtp(dto: SendOtpDto) {
    const type = dto.type;
    const purpose = dto.purpose;
    const phoneNumber = dto.phoneNumber?.trim();
    const email = dto.email?.trim();
    this.getIdentifier(type, phoneNumber, email);

    if (type === OtpType.PHONE) {
      const existingIdentity = await this.identityService.findByPhoneNumber(
        phoneNumber!,
      );

      if (purpose === OtpPurpose.REGISTER && existingIdentity) {
        throw new ConflictException('Phone number already registered');
      }

      if (purpose === OtpPurpose.FORGOT_PASSWORD && !existingIdentity) {
        throw new BadRequestException('Phone number not found');
      }
    }

    if (type === OtpType.EMAIL) {
      const existingIdentity = await this.identityService.findByEmail(email!);

      if (purpose === OtpPurpose.REGISTER && existingIdentity) {
        throw new ConflictException('Email already registered');
      }

      if (purpose === OtpPurpose.FORGOT_PASSWORD && !existingIdentity) {
        throw new BadRequestException('Email not found');
      }
    }

    const cooldownSeconds = this.getPositiveInteger(
      'app.otpResendCooldownSeconds',
      60,
    );

    const latestOtp = await this.otpRepository.findLatest(
      type,
      purpose,
      phoneNumber,
      email,
    );

    if (latestOtp) {
      const elapsedSeconds =
        (Date.now() - latestOtp.createdAt.getTime()) / 1000;

      if (elapsedSeconds < cooldownSeconds) {
        throw new TooManyRequestsException(
          `Please wait ${Math.ceil(
            cooldownSeconds - elapsedSeconds,
          )} seconds before requesting another OTP.`,
        );
      }
    }

    const cooldownKey = this.getOtpCooldownKey(
      type,
      purpose,
      phoneNumber,
      email,
    );

    const cooldownToken = randomUUID();
    let cooldownAcquired: boolean;

    try {
      cooldownAcquired = await this.cacheService.setIfNotExists(
        cooldownKey,
        cooldownToken,
        cooldownSeconds,
      );
    } catch {
      throw new ServiceUnavailableException(
        'OTP service is currently unavailable',
      );
    }

    if (!cooldownAcquired) {
      const remainingSeconds = await this.cacheService.ttl(cooldownKey);

      throw new TooManyRequestsException(
        `Please wait ${Math.max(
          1,
          remainingSeconds,
        )} seconds before requesting another OTP.`,
      );
    }

    let createdOtpId: string | undefined;

    try {
      await this.otpRepository.deleteUnverified(
        type,
        purpose,
        phoneNumber,
        email,
      );

      await this.deleteOtpState(type, purpose, phoneNumber, email);

      const otp = this.generateOtp();
      const otpHash = await this.hashOtp(otp);
      const expiryMinutes = this.getPositiveInteger('app.otpExpiryMinutes', 5);
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
      const createdOtp = await this.otpRepository.create({
        type,
        purpose,
        phoneNumber,
        email,
        otpHash,
        expiresAt,
      });

      createdOtpId = createdOtp.id;
      await this.cacheOtp(
        type,
        purpose,
        createdOtp.id,
        otpHash,
        expiresAt,
        phoneNumber,
        email,
      );

      const eventId = randomUUID();

      if (type === OtpType.EMAIL) {
        await this.kafkaProducer.publish(KAFKA_TOPICS.EMAIL_SEND, {
          eventId,
          to: email,
          otp,
        });
      }

      if (type === OtpType.PHONE) {
        await this.kafkaProducer.publish(KAFKA_TOPICS.SMS_SEND, {
          eventId,
          phoneNumber,
          message: `Your OTP is ${otp}. It is valid for ${expiryMinutes} minutes. Do not share it.`,
        });
      }

      const showOtpConfig = this.configService.get<boolean | string>(
        'app.showOtpInResponse',
      );

      const showOtp =
        process.env.NODE_ENV !== 'production' &&
        (showOtpConfig === true || showOtpConfig === 'true');

      return {
        success: true,

        ...(showOtp && {
          otp,
        }),

        expiresInSeconds: expiryMinutes * 60,

        message: 'OTP sent successfully',
      };
    } catch (error) {
      await Promise.allSettled([
        this.deleteOtpState(type, purpose, phoneNumber, email),

        this.cacheService.deleteIfValueMatches(cooldownKey, cooldownToken),

        createdOtpId
          ? this.otpRepository.deleteById(createdOtpId)
          : Promise.resolve(),
      ]);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown OTP sending error';

      this.logger.error(
        `OTP sending failed for ${type}/${purpose}: ${errorMessage}`,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new ServiceUnavailableException('Unable to send OTP at this time');
    }
  }

  async verifyOtp(
    type: OtpType,
    purpose: OtpPurpose,
    otp: string,
    phoneNumber?: string,
    email?: string,
  ) {
    const normalizedPhoneNumber = phoneNumber?.trim();

    const normalizedEmail = email?.trim();

    this.getIdentifier(type, normalizedPhoneNumber, normalizedEmail);

    const verificationLockKey = this.getVerificationLockKey(
      type,
      purpose,
      normalizedPhoneNumber,
      normalizedEmail,
    );

    const verificationLockToken = randomUUID();

    let lockAcquired: boolean;
    try {
      lockAcquired = await this.cacheService.setIfNotExists(
        verificationLockKey,
        verificationLockToken,
        30,
      );
    } catch {
      throw new ServiceUnavailableException(
        'OTP verification service is currently unavailable',
      );
    }

    if (!lockAcquired) {
      throw new TooManyRequestsException(
        'OTP verification is already in progress',
      );
    }

    try {
      const record = await this.getCacheOtp(
        type,
        purpose,
        normalizedPhoneNumber,
        normalizedEmail,
      );
      if (!record) {
        throw new BadRequestException('OTP not found or expired');
      }
      const expiryTime = new Date(record.expiresAt).getTime();

      if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
        await this.deleteOtpState(
          type,
          purpose,
          normalizedPhoneNumber,
          normalizedEmail,
        );

        throw new BadRequestException('OTP has expired');
      }

      const maxAttempts = this.getPositiveInteger('app.otpMaxAttempts', 5);

      const attemptsKey = this.getOtpAttemptsKey(
        type,
        purpose,
        normalizedPhoneNumber,
        normalizedEmail,
      );
      const cachedAttempts =
        (await this.cacheService.get<number>(attemptsKey)) ?? 0;
      const legacyAttempts = Number(record.attempts ?? 0);

      if (cachedAttempts + legacyAttempts >= maxAttempts) {
        await this.deleteOtpState(
          type,
          purpose,
          normalizedPhoneNumber,
          normalizedEmail,
        );

        throw new TooManyRequestsException(
          'Maximum OTP verification attempts exceeded',
        );
      }

      const valid = await this.verifyHash(record.otpHash, otp);
      const latestDatabaseOtp = record.otpId
        ? null
        : await this.otpRepository.findLatest(
            type,
            purpose,
            normalizedPhoneNumber,
            normalizedEmail,
          );

      const otpId = record.otpId ?? latestDatabaseOtp?.id;

      if (!otpId) {
        await this.deleteOtpState(
          type,
          purpose,
          normalizedPhoneNumber,
          normalizedEmail,
        );

        throw new BadRequestException('OTP record not found or expired');
      }
      if (!valid) {
        const redisAttempts = await this.cacheService.incrementWithExpiry(
          attemptsKey,
          this.getRemainingTtl(record.expiresAt),
        );

        await Promise.allSettled([
          this.otpRepository.increaseAttemptsIfPending(otpId),
        ]);
        const totalAttempts = legacyAttempts + redisAttempts;

        if (totalAttempts >= maxAttempts) {
          await this.deleteOtpState(
            type,
            purpose,
            normalizedPhoneNumber,
            normalizedEmail,
          );

          throw new TooManyRequestsException(
            'Maximum OTP verification attempts exceeded',
          );
        }

        throw new BadRequestException('Invalid OTP');
      }
      const verificationResult =
        await this.otpRepository.markVerifiedIfPending(otpId);

      if (verificationResult.count !== 1) {
        await this.deleteOtpState(
          type,
          purpose,
          normalizedPhoneNumber,
          normalizedEmail,
        );

        throw new BadRequestException('OTP has already been used or expired');
      }
      await Promise.allSettled([
        this.deleteOtpState(
          type,
          purpose,
          normalizedPhoneNumber,
          normalizedEmail,
        ),
      ]);

      return {
        success: true,
        message: 'OTP verified successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown OTP verification error';

      this.logger.error(
        `OTP verification failed for ${type}/${purpose}: ${message}`,
      );

      throw new ServiceUnavailableException(
        'OTP verification service is currently unavailable',
      );
    } finally {
      try {
        await this.cacheService.deleteIfValueMatches(
          verificationLockKey,
          verificationLockToken,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown Redis lock release error';

        this.logger.error(
          `Failed to release OTP verification lock: ${message}`,
        );
      }
    }
  }

  async isPhoneVerified(phoneNumber: string): Promise<boolean> {
    const otp = await this.otpRepository.findVerified(
      OtpType.PHONE,
      OtpPurpose.REGISTER,
      phoneNumber,
    );
    return !!otp;
  }

  async isEmailVerified(email: string): Promise<boolean> {
    const otp = await this.otpRepository.findVerified(
      OtpType.EMAIL,
      OtpPurpose.REGISTER,
      undefined,
      email,
    );
    return !!otp;
  }
}
