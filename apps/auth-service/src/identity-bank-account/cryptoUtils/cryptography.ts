import * as crypto from 'crypto';
import { BadRequestError } from '../../../../../libs/errors/ApiError';
import { RpcException } from '@nestjs/microservices';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey(secret: string): Buffer {
  if (!secret) {
    throw new BadRequestError('Encryption secret is required');
  }
  return crypto
    .createHash('sha256')
    .update(secret, 'utf8')
    .digest()
    .subarray(0, KEY_LENGTH);
}

export function encryptData(data: string): string {
  if (!data) {
    throw new RpcException('Data is required for encryption');
  }

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new RpcException('Encryption secret is required');
  }

  const key = getKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Store IV + authTag + ciphertext together
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptData(encryptedData: string): string {
  if (!encryptedData) {
    throw new RpcException('Encrypted data is required');
  }

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new RpcException('Encryption secret is required');
  }

  const [ivBase64, authTagBase64, encryptedBase64] = encryptedData.split('.');

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new RpcException('Invalid encrypted data format');
  }

  const key = getKey(secret);

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
