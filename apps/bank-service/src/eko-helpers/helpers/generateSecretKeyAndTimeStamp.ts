import crypto from 'crypto';

export const generateSecretKeyAndSecretTimeStamp = (accessKey: string) => {
  // 1. Base64 encode access key

  const encodedKey = Buffer.from(accessKey).toString('base64');

  // 2. Current timestamp in milliseconds

  const secretKeyTimestamp = Date.now().toString();

  // 3. HMAC SHA256

  // IMPORTANT:

  // Use encodedKey DIRECTLY.

  const hmac = crypto.createHmac('sha256', encodedKey);

  hmac.update(secretKeyTimestamp);

  // 4. Base64 encode HMAC result

  const secretKey = hmac.digest('base64');

  return {
    secretKey,
    secretKeyTimestamp,
  };
};
