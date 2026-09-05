import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class VimopayDebugGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const nodeEnv = String(this.configService.get('NODE_ENV') ?? '')
      .trim()
      .toLowerCase();

    const debugEnabled =
      String(this.configService.get('AEPS_VIMOPAY_DEBUG_ENABLED') ?? 'false')
        .trim()
        .toLowerCase() === 'true';

    /*
     * Production mein debug route
     * kisi condition mein expose nahi hoga.
     */
    if (nodeEnv === 'production') {
      throw new NotFoundException();
    }

    if (!debugEnabled) {
      throw new NotFoundException();
    }

    return true;
  }
}
