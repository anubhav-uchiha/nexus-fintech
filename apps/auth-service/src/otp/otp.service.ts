import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { OtpRepository } from './repository/otp.repository';
import { randomInt } from 'crypto';
import { IdentityService } from './../identity/identity.service';
import { OtpPurpose, OtpType } from '../../generated/prisma/enums';
import { SendOtpDto } from './dto/send-otp.dto';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'libs/cache/src';
import { KAFKA_TOPICS, KafkaProducerService } from 'libs/kafka/src';
import { identity } from 'rxjs';

@Injectable()
export class OtpService {
  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly identityService: IdentityService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}
  private generateOtp(): string {
    return randomInt(100000, 999999).toString();
  }

  private async hashOtp(otp: string): Promise<string> {
    return argon2.hash(otp);
  }

  private async verifyHash(hash: string, otp: string): Promise<boolean> {
    return argon2.verify(hash, otp);
  }

  private getOtpCacheKey(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): string {
    const identifier = type === OtpType.PHONE ? phoneNumber : email;
    return `otp:${type}:${purpose}:${identifier}`;
  }

  private async cacheOtp(
    type: OtpType,
    purpose: OtpPurpose,
    otpHash: string,
    expiresAt: Date,
    phoneNumber?: string,
    email?: string,
  ) {
    const ttl = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    const key = this.getOtpCacheKey(type, purpose, phoneNumber, email);

    await this.cacheService.set(
      key,
      { otpHash, attempt: 0, expiresAt: expiresAt.toISOString() },
      ttl,
    );
  }

  private async getCacheOtp(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ): Promise<{ otpHash: string; attempts: number; expiresAt: string } | null> {
    const key = this.getOtpCacheKey(type, purpose, phoneNumber, email);
    return this.cacheService.get(key);
  }

  private async deleteCachedOtp(
    type: OtpType,
    purpose: OtpPurpose,
    phoneNumber?: string,
    email?: string,
  ) {
    const key = this.getOtpCacheKey(type, purpose, phoneNumber, email);

    await this.cacheService.del(key);
  }

  async sendOtp(dto: SendOtpDto) {
    const { type, purpose, phoneNumber, email } = dto;

    if (type === OtpType.PHONE && !phoneNumber) {
      throw new BadRequestException('Phone number is required');
    }

    if (type === OtpType.EMAIL && !email) {
      throw new BadRequestException('Email is required');
    }

    if (type === OtpType.PHONE) {
      const identity = await this.identityService.findByPhoneNumber(
        phoneNumber!,
      );

      if (purpose === OtpPurpose.REGISTER && identity) {
        throw new BadRequestException('Phone number already registered');
      }

      if (purpose === OtpPurpose.FORGOT_PASSWORD && !identity) {
        throw new BadRequestException('Phone number not found');
      }
    }

    if (type === OtpType.EMAIL) {
      const identity = await this.identityService.findByEmail(email!);

      if (purpose === OtpPurpose.REGISTER && identity) {
        throw new BadRequestException('Email already registered');
      }

      if (purpose === OtpPurpose.FORGOT_PASSWORD && !identity) {
        throw new BadRequestException('Email not found');
      }
    }

    const latestOtp = await this.otpRepository.findLatest(
      type,
      purpose,
      phoneNumber,
      email,
    );

    if (latestOtp) {
      const seconds = (Date.now() - latestOtp.createdAt.getTime()) / 1000;

      const cooldown = this.configService.get<number>(
        'app.otpResendCooldownSeconds',
      )!;

      if (seconds < cooldown) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(
            cooldown - seconds,
          )} seconds before requesting another OTP.`,
        );
      }
    }
    await this.otpRepository.deleteUnverified(
      type,
      purpose,
      phoneNumber,
      email,
    );

    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);

    const expiryMinutes = this.configService.get<number>(
      'app.otpExpiryMinutes',
    )!;

    console.log('expiryMinutes:', expiryMinutes);
    console.log('typeof expiryMinutes:', typeof expiryMinutes);

    const expiresAt = new Date();

    expiresAt.setMinutes(expiresAt.getMinutes() + Number(expiryMinutes));

    console.log('expiresAt:', expiresAt);
    console.log('isValid:', !isNaN(expiresAt.getTime()));

    console.log({
      type,
      purpose,
      phoneNumber,
      email,
      otpHash,
      expiresAt,
    });
    await this.otpRepository.create({
      type,
      purpose,
      phoneNumber,
      email,
      otpHash,
      expiresAt,
    });

    await this.cacheOtp(type, purpose, otpHash, expiresAt, phoneNumber, email);

    if (type === OtpType.EMAIL) {
      await this.kafkaProducer.publish(KAFKA_TOPICS.EMAIL_SEND, {
        to: email,
        otp,
      });
    }

    if (type === OtpType.PHONE) {
      await this.kafkaProducer.publish(KAFKA_TOPICS.SMS_SEND, {
        phoneNumber,
        otp,
      });
    }

    const showOtp = this.configService.get<boolean>('app.showOtpInResponse');

    return {
      success: true,
      ...(showOtp && { otp }),
      message: 'OTP sent successfully',
    };
  }

  async verifyOtp(
    type: OtpType,
    purpose: OtpPurpose,
    otp: string,
    phoneNumber?: string,
    email?: string,
  ) {
    const record = await this.getCacheOtp(type, purpose, phoneNumber, email);

    if (!record) {
      throw new BadRequestException('OTP not found');
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await this.deleteCachedOtp(type, purpose, phoneNumber, email);
      throw new BadRequestException('OTP has expired');
    }

    const maxAttempts =
      this.configService.get<number>('app.otpMaxAttempts') ?? 5;

    if (record.attempts >= maxAttempts) {
      await this.deleteCachedOtp(type, purpose, phoneNumber, email);
      throw new BadRequestException(
        'Maximum OTP verification attempts exceeded.',
      );
    }

    const valid = await this.verifyHash(record.otpHash, otp);
    if (!valid) {
      const key = this.getOtpCacheKey(type, purpose, phoneNumber, email);

      await this.cacheService.set(
        key,
        { ...record, attempts: record.attempts + 1 },
        Math.max(
          1,
          Math.floor(
            (new Date(record.expiresAt).getTime() - Date.now()) / 1000,
          ),
        ),
      );
      throw new BadRequestException('Invalid OTP');
    }
    await this.deleteCachedOtp(type, purpose, phoneNumber, email);

    const dbRecord = await this.otpRepository.findLatest(
      type,
      purpose,
      phoneNumber,
      email,
    );

    if (dbRecord) {
      await this.otpRepository.markVerified(dbRecord.id);
    }

    return {
      success: true,
      message: 'OTP verified successfully',
    };
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
