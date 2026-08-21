import { Request } from 'express';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
}

function detectOperatingSystem(userAgent: string): string {
  if (/android/i.test(userAgent)) {
    return 'Android';
  }

  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return 'iOS';
  }

  if (/windows/i.test(userAgent)) {
    return 'Windows';
  }

  if (/macintosh|mac os x/i.test(userAgent)) {
    return 'macOS';
  }

  if (/linux/i.test(userAgent)) {
    return 'Linux';
  }

  return 'Unknown OS';
}

function detectBrowser(userAgent: string): string {
  if (/edg\//i.test(userAgent)) {
    return 'Edge';
  }

  if (/opr\/|opera/i.test(userAgent)) {
    return 'Opera';
  }

  if (/chrome\/|crios\//i.test(userAgent)) {
    return 'Chrome';
  }

  if (/firefox\/|fxios\//i.test(userAgent)) {
    return 'Firefox';
  }

  if (/safari/i.test(userAgent)) {
    return 'Safari';
  }

  if (/postman/i.test(userAgent)) {
    return 'Postman';
  }

  return 'Unknown Browser';
}

function detectDeviceType(userAgent: string): string {
  if (/ipad|tablet/i.test(userAgent)) {
    return 'Tablet';
  }

  if (/mobile|android|iphone|ipod/i.test(userAgent)) {
    return 'Mobile';
  }

  return 'Desktop';
}

export function extractRequestMetadata(request: Request): RequestMetadata {
  const rawIpAddress = request.ip ?? request.socket.remoteAddress;

  const ipAddress = rawIpAddress?.replace(/^::ffff:/, '').slice(0, 45);

  const userAgent = request.get('user-agent')?.trim().slice(0, 500);

  if (!userAgent) {
    return {
      ipAddress,
    };
  }

  const browser = detectBrowser(userAgent);
  const operatingSystem = detectOperatingSystem(userAgent);
  const deviceType = detectDeviceType(userAgent);
  const device = `${browser} on ${operatingSystem} (${deviceType})`.slice(
    0,
    150,
  );

  return {
    ipAddress,
    userAgent,
    device,
  };
}
