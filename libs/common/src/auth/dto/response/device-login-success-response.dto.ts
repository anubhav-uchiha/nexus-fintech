import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeviceLoginSuccessResponseDto {
  @ApiProperty({
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'JWT access token',
  })
  accessToken!: string;

  @ApiProperty({
    example: {
      deviceId: 'windows-pc-001',
      trustedUntil: '2026-09-20T07:32:39.216Z',
    },
  })
  trustedDevice!: {
    deviceId: string;
    trustedUntil: string;
  };

  @ApiProperty({
    example: false,
  })
  onboardingRequired!: boolean;

  @ApiPropertyOptional({
    example: 'PHONE_PENDING',
  })
  onboardingStatus?: string;

  @ApiPropertyOptional({
    example: 'VERIFY_PHONE_OTP',
  })
  nextStep?: string;

  @ApiProperty({
    example: {
      id: 'ba0ad2c1-29ca-4c26-b8ad-154b783308f3',
      loginId: 'ADMIN1005',
      fullName: 'Amit Kumar',
      username: 'amit_kumar',
      email: 'user@example.com',
      phoneNumber: '+919876543210',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  identity!: Record<string, unknown>;
}
