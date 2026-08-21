import { Prisma } from 'apps/auth-service/generated/prisma/client';

export type CompleteRegistrationData = {
  draftId: string;
  identity: Omit<Prisma.IdentityCreateInput, 'loginId' | 'role'>;
};
