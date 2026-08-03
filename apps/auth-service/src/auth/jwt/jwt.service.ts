import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { SignOptions } from 'jsonwebtoken';

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
      expiresIn = Math.max(
        1,
        Math.floor((refreshExpiresAt.getTime() - Date.now()) / 1000),
      );
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

  async generateTokens(payload: JwtPayload, refreshExpiresAt?: Date) {
    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(
      payload,
      refreshExpiresAt,
    );
    return {
      accessToken,
      refreshToken,
    };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
  }
  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
    });
  }
}
