import { Prisma } from 'apps/auth-service/generated/prisma/client';

export type CompleteRegistrationData = {
  identity: Prisma.IdentityCreateInput;
  draftId: string;
};
