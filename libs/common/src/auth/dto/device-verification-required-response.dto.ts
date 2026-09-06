export class DeviceVerificationRequiredResponse {
  requiresDeviceVerification!: true;
  challengeId!: string;
  maskedEmail!: string;
  expiresAt!: Date;
  message!: string;
}
