export const SESSION_VALIDATION_CACHE_PREFIX = 'gateway:session-validation';

export const SESSION_VALIDATION_VERSION_PREFIX =
  'gateway:session-validation-version';

export function getSessionValidationVersionKey(identityId: string): string {
  return `${SESSION_VALIDATION_VERSION_PREFIX}:${identityId}`;
}

export function getSessionValidationCacheKey(
  identityId: string,
  sessionId: string,
  version: number,
): string {
  return `${SESSION_VALIDATION_CACHE_PREFIX}:${identityId}:${version}:${sessionId}`;
}
