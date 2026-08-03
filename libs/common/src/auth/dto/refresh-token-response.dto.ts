export class RefreshTokenResponseDto {
  accessToken!: string;

  identity!: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phoneNumber: string;
    role: string;
    status: string;
  };
}
