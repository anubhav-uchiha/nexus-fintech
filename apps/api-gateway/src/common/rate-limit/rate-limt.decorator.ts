import { SetMetadata } from '@nestjs/common';
import {
  RATE_LIMIT_PROFILE_KEY,
  RateLimitProfileName,
  SKIP_RATE_LIMIT_KEY,
} from './rate-limit.constants';

export const RateLimitProfile = (profile: RateLimitProfileName) =>
  SetMetadata(RATE_LIMIT_PROFILE_KEY, profile);

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
