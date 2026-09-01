export interface NotificationEvent {
  to: string;
  subject?: string;
  template?: string;
  otp?: string;
  phoneNumber?: string;
  message?: string;
  data?: Record<string, unknown>;
}
