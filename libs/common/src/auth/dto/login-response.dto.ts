export class LoginResponseDto {
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
