export interface AuthNotificationEvent {
  eventId: string;
  identityId: string;
  phoneNumber: string;
  email?: string;
  occurredAt: string;
  data?: Record<string, unknown>;
}
