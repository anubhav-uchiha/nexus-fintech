import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { SignOptions } from 'jsonwebtoken';

interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly config: ConfigService,
  ) {}

  async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow<string>(
        'JWT_ACCESS_EXPIRES',
      ) as SignOptions['expiresIn'],
      //   expiresIn: '15m',
    });
  }

  async generateRefreshToken(
    payload: JwtPayload,
    refreshExpiresAt?: Date,
  ): Promise<string> {
    let expiresIn: SignOptions['expiresIn'];

    if (refreshExpiresAt) {
      const remainingSeconds = Math.floor(
        (refreshExpiresAt.getTime() - Date.now()) / 1000,
      );
      if (remainingSeconds <= 0) {
        throw new Error('Refresh token expiry must be in the future');
      }
      expiresIn = remainingSeconds;
    } else {
      expiresIn = this.config.getOrThrow<string>(
        'JWT_REFRESH_EXPIRES',
      ) as SignOptions['expiresIn'];
    }
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn,
    });
  }

  async generateTokens(
    payload: JwtPayload,
    refreshExpiresAt?: Date,
  ): Promise<GeneratedTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload, refreshExpiresAt),
    ]);
    const decodedRefreshToken = this.jwtService.decode(refreshToken);

    if (
      !decodedRefreshToken ||
      typeof decodedRefreshToken !== 'object' ||
      typeof decodedRefreshToken.exp !== 'number'
    ) {
      throw new Error(
        'Generated refresh token does not contain a valid expiry',
      );
    }

    const calculatedRefreshExpiresAt = new Date(decodedRefreshToken.exp * 1000);
    if (Number.isNaN(calculatedRefreshExpiresAt.getTime())) {
      throw new Error('Generated refresh token expiry is invalid');
    }

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: calculatedRefreshExpiresAt,
    };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }
  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }
}
