export interface AuthNotificationEvent {
  eventId: string;
  identityId: string;
  phoneNumber?: string | null;
  email?: string | null;
  occurredAt: string;
  data?: Record<string, unknown>;
}
