import { ApiProperty } from '@nestjs/swagger';

export class DeviceVerificationRequiredResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates that the login requires device OTP verification',
  })
  requiresDeviceVerification!: boolean;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Device verification challenge ID',
  })
  challengeId!: string;

  @ApiProperty({
    example: 'a***@gmail.com',
    description: 'Masked email address where the verification OTP was sent',
  })
  maskedEmail!: string;

  @ApiProperty({
    example: '2026-09-05T14:30:00.000Z',
    description: 'Time at which the device verification challenge expires',
  })
  expiresAt!: string;

  @ApiProperty({
    example: 'Device verification required. OTP sent to registered email.',
  })
  message!: string;
}
