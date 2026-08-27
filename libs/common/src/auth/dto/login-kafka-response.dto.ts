export class LoginKafkaResponseDto {
  accessToken!: string;
  refreshToken!: string;

  identity!: {
    id: string;
    fullName: string;
    loginId: string;
    username: string;
    email: string;
    phoneNumber: string;
    passwordChangedAt: Date | null;
    role: string;
    status: string;
    preferredLoginMethod: string;
  };
}
