import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class SuperAdminOnboardingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const validation = request.superAdminSession as
      | {
          valid: boolean;
          onboardingCompleted: boolean;
          onboardingStatus?: string;
        }
      | undefined;

    if (!validation?.valid) {
      throw new ForbiddenException('Invalid Super Admin session');
    }

    if (!validation.onboardingCompleted) {
      throw new ForbiddenException({
        message: 'Complete Super Admin onboarding before accessing dashboard',
        onboardingRequired: true,
        onboardingStatus: validation.onboardingStatus,
      });
    }

    return true;
  }
}
