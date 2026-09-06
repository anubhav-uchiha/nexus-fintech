export type AccountOnboardingStatusValue =
  | 'CREDENTIALS_ISSUED'
  | 'PHONE_PENDING'
  | 'PAN_PENDING'
  | 'CREDENTIAL_CHANGE_REQUIRED'
  | 'COMPLETED';

export class LoginKafkaResponseDto {
  accessToken!: string;
  refreshToken!: string;
  refreshExpiresAt!: Date;
  onboardingRequired!: boolean;
  onboardingStatus?: AccountOnboardingStatusValue;
  nextStep?: string | null;

  identity!: {
    id: string;
    fullName: string;
    loginId: string;
    username: string;
    email: string;
    phoneNumber: string | null;
    passwordChangedAt: Date | null;
    mpinChangedAt: Date | null;
    role: string;
    status: string;
    preferredLoginMethod: string;
  };
}
