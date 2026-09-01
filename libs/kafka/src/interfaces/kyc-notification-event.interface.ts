export interface KycNotificationEvent {
  eventId: string;
  identityId: string;
  kycId: string;
  occurredAt: string;
  reasonCode?: string;
}
