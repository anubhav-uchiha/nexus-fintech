import { LoginMethod } from 'apps/auth-service/generated/prisma/enums';

export class RefreshKafkaResponseDto {
  accessToken!: string;

  refreshToken!: string;

  identity!: {
    id: string;
    fullName: string;
    username: string;
    email: string;
    phoneNumber: string | null;
    role: string;
    status: string;
    passwordChangedAt: Date | null;
    mpinChangedAt: Date | null;
    preferredLoginMethod: LoginMethod;
  };
}
