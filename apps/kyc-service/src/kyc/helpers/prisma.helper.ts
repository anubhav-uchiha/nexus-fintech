import { Prisma } from 'apps/kyc-service/generated/kyc-prisma/client';

export function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export function getPrismaUniqueConstraintTarget(error: unknown): string[] {
  if (!isPrismaUniqueConstraintError(error)) {
    return [];
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.map(String);
  }
  if (typeof target === 'string') {
    return [target];
  }
  return [];
}
