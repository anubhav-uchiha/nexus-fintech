export class RefreshTokenResponseDto {
  accessToken!: string;

  identity!: {
    id: string;
    fullName: string;
    username: string;
    email: string;
    phoneNumber: string;
    role: string;
    status: string;
  };
}
