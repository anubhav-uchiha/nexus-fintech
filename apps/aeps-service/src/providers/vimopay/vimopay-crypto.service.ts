import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv } from 'crypto';

@Injectable()
export class VimopayCryptoService {
  private readonly key: Buffer;
  private readonly iv: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.getRequiredConfig('AEPS_VIMO_SECRET_KEY');

    const saltKey = this.getRequiredConfig('AEPS_VIMO_SALT_KEY');

    /*
     * UAT live verification:
     *
     * AES Key = secretKey
     * AES IV  = saltKey
     */
    this.key = Buffer.from(secretKey.trim(), 'utf8');

    this.iv = Buffer.from(saltKey.trim(), 'utf8');

    if (![16, 24, 32].includes(this.key.length)) {
      throw new InternalServerErrorException(
        `Invalid VimoPay AES key length: ${this.key.length}`,
      );
    }
  }

  encrypt(payload: unknown): string {
    const plainText =
      typeof payload === 'string' ? payload : JSON.stringify(payload);

    try {
      const cipher = createCipheriv(this.getAlgorithm(), this.key, this.iv, {
        authTagLength: 16,
      });

      const encrypted = Buffer.concat([
        cipher.update(plainText, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      /*
       * VimoPay/PDF format:
       *
       * ciphertext + authTag
       *          ↓
       *        Base64
       */
      return Buffer.concat([encrypted, authTag]).toString('base64');
    } catch {
      throw new InternalServerErrorException(
        'Unable to encrypt VimoPay request',
      );
    }
  }

  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      throw new InternalServerErrorException(
        'VimoPay encrypted response is empty',
      );
    }

    try {
      const normalized = encryptedText.trim().replace(/\s+/g, '');

      const encryptedWithTag = Buffer.from(normalized, 'base64');

      if (encryptedWithTag.length <= 16) {
        throw new Error('Invalid encrypted response');
      }

      const ciphertext = encryptedWithTag.subarray(
        0,
        encryptedWithTag.length - 16,
      );

      const authTag = encryptedWithTag.subarray(encryptedWithTag.length - 16);

      const decipher = createDecipheriv(
        this.getAlgorithm(),
        this.key,
        this.iv,
        {
          authTagLength: 16,
        },
      );

      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8').trim();
    } catch {
      throw new InternalServerErrorException(
        'Unable to decrypt VimoPay response',
      );
    }
  }

  encryptRequestBody(payload: unknown): {
    requestBody: string;
  } {
    return {
      requestBody: this.encrypt(payload),
    };
  }

  decryptJson<T>(encryptedText: string): T {
    const decrypted = this.decrypt(encryptedText);

    try {
      return JSON.parse(decrypted) as T;
    } catch {
      throw new InternalServerErrorException(
        'VimoPay decrypted response is not valid JSON',
      );
    }
  }

  private getAlgorithm(): 'aes-128-gcm' | 'aes-192-gcm' | 'aes-256-gcm' {
    switch (this.key.length) {
      case 16:
        return 'aes-128-gcm';

      case 24:
        return 'aes-192-gcm';

      case 32:
        return 'aes-256-gcm';

      default:
        throw new InternalServerErrorException(
          'Unsupported VimoPay AES key length',
        );
    }
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }

    return value;
  }
}
