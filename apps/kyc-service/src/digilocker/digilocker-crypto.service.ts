import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class DigiLockerCryptoService {
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encodedKey = this.configService.get<string>(
      'DIGILOCKER_SESSION_ENCRYPTION_KEY',
    );

    if (!encodedKey) {
      throw new Error('DIGILOCKER_SESSION_ENCRYPTION_KEY is not configured');
    }

    this.encryptionKey = Buffer.from(encodedKey, 'base64');

    if (this.encryptionKey.length !== 32) {
      throw new Error(
        'DIGILOCKER_SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
      );
    }
  }

  generatePkcePair() {
    const codeVerifier = randomBytes(64).toString('base64url');

    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256' as const,
    };
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    const authenticationTag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      authenticationTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(encryptedValue: string): string {
    try {
      const [version, ivValue, tagValue, ciphertextValue] =
        encryptedValue.split('.');

      if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
        throw new Error('Invalid encrypted value');
      }

      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(ivValue, 'base64url'),
      );

      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64url')),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      throw new RpcException({
        statusCode: 500,
        message: 'DigiLocker session security validation failed',
      });
    }
  }
}
