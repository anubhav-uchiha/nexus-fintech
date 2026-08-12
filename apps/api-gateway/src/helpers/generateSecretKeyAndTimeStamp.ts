import crypto from 'crypto';


export const generateSecretKeyAndSecretTimeStamp = (accessKey: string) => {
  // Encode it using base64

  let encodedKey = Buffer.from(accessKey).toString('base64');

  // Get current timestamp in milliseconds since UNIX epoch

  let secretKeyTimestamp = Date.now();

  // Computes the signature by hashing the salt with the encoded key

  let hmac = crypto.createHmac('sha256', Buffer.from(encodedKey, 'base64'));

  hmac.update(secretKeyTimestamp.toString());

  let secretKey = hmac.digest('base64');

  console.log('secret-key: ' + secretKey);

  console.log('secret-key-timestamp: ' + secretKeyTimestamp);
  return { secretKey, secretKeyTimestamp };
};
