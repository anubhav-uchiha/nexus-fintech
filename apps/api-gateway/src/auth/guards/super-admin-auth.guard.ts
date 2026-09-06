import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from 'apps/auth-service/src/auth/jwt/interfaces/jwt-payload.interface';
import { AuthGatewayService } from '../auth.gateway.service';

export interface SuperAdminAuthenticatedRequest extends Request {
  user: JwtPayload;

  superAdminSession: {
    valid: boolean;
    onboardingStatus?: string;
    onboardingCompleted?: boolean;
  };
}

@Injectable()
export class SuperAdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
    private readonly authGatewayService: AuthGatewayService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<SuperAdminAuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Super Admin access token is required');
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Super Admin access token is required');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired Super Admin access token',
      );
    }

    if (
      !payload.sub ||
      !payload.sid ||
      payload.accountType !== 'SUPER_ADMIN' ||
      payload.role !== 'SUPER_ADMIN'
    ) {
      throw new UnauthorizedException('Invalid Super Admin token');
    }

    const session = await this.authGatewayService.validateSuperAdminSession(
      payload.sub,
      payload.sid,
    );

    if (!session.valid) {
      throw new UnauthorizedException('Super Admin session is no longer valid');
    }

    request.user = payload;
    request.superAdminSession = session;

    return true;
  }
}
