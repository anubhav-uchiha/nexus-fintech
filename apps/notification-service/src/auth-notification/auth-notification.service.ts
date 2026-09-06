import { Injectable, Logger } from '@nestjs/common';
import { AuthNotificationEvent } from 'libs/kafka/src';
import {
  EMAIL_JOB_NAMES,
  EmailJob,
  QUEUE_NAMES,
  QueueService,
  SMS_JOB_NAMES,
  SmsJob,
} from 'libs/queue/src';

@Injectable()
export class AuthNotificationService {
  private readonly logger = new Logger(AuthNotificationService.name);

  constructor(private readonly queueService: QueueService) {}

  async queueRegistrationCredentials(payload: unknown): Promise<void> {
    const event = this.parseEvent(payload, 'registeration credentials');

    if (!event) {
      return;
    }

    const loginId = this.getRequiredDataString(
      event,
      'loginId',
      'registration creditioals',
    );

    const temporaryPassword = this.getRequiredDataString(
      event,
      'temporaryPassword',
      'registration credentials',
    );

    const temporaryMpin = this.getRequiredDataString(
      event,
      'temporaryMpin',
      'registation credentials',
    );

    if (!loginId || !temporaryPassword || !temporaryMpin) {
      return;
    }

    const message = [
      'welcome to UmiPay',
      '',
      `Login Id: ${loginId}`,
      `Temporary Password: ${temporaryPassword}`,
      `Temporary MPIN: ${temporaryMpin}`,
      '',
      'Please change your password and MPIN after your first login.',
    ].join('\n');

    if (event.email) {
      await this.queueService.add<EmailJob>(
        QUEUE_NAMES.EMAIL,
        EMAIL_JOB_NAMES.SEND,
        {
          type: 'ACCOUNT_CREDENTIALS',
          to: event.email,
          loginId,
          temporaryPassword,
          temporaryMpin,
          fullName:
            typeof event.data?.fullName === 'string'
              ? event.data.fullName
              : undefined,
          role:
            typeof event.data?.role === 'string' ? event.data.role : undefined,
          expiresAt:
            typeof event.data?.expiresAt === 'string'
              ? event.data.expiresAt
              : undefined,
        },
        {
          jobId: `email-credentials-${event.eventId}`,
        },
      );

      this.logger.log(
        `Registration credentials email ${event.eventId} queued successfully`,
      );

      return;
    }

    await this.queueSms(event, message, 'registration credentials');
  }

  async queuePasswordChanged(payload: unknown): Promise<void> {
    const event = this.parseEvent(payload, 'password changed');

    if (!event) {
      return;
    }

    const message = [
      'UmiPay Security Alert',
      '',
      'Your account password was changed successfully.',
      'Other active sessions have been logged out.',
      '',
      'If you did not name this.change, contact support immediately.',
    ].join('\n');
    await this.queueSms(event, message, 'password changed');
  }
  async queueMpinchanged(payload: unknown): Promise<void> {
    const event = this.parseEvent(payload, 'MPIN changed');

    if (!event) {
      return;
    }
    const message = [
      'UmiPay Security Alert',
      '',
      'Your account MPIN was changed successfully.',
      'Other active sessions have been logged out',
      '',
      'If you did not make this change,contact support immediately',
    ].join('\n');
    await this.queueSms(event, message, 'MPIN changed');
  }

  async queuePasswordReset(payload: unknown): Promise<void> {
    const event = this.parseEvent(payload, 'password reset');

    if (!event) {
      return;
    }

    const message = [
      'UmiPay Security Alert',
      '',
      'Your password was reset successfully.',
      'All existing sessions have been logged out.',
      '',
      'If you did not request this reset, contact support immediately.',
    ].join('\n');

    await this.queueSms(event, message, 'password reset');
  }

  async queueLoginMethodChanged(payload: unknown): Promise<void> {
    const event = this.parseEvent(payload, 'login method changed');

    if (!event) {
      return;
    }

    const preferredLoginMethod = this.getRequiredDataString(
      event,
      'preferredLoginMethod',
      'login method chnaged',
    );

    if (!preferredLoginMethod) {
      return;
    }

    const message = [
      'UmiPay Security Alert',
      '',
      `Your preferred login method was changed to ${preferredLoginMethod}.`,
      '',
      'If you did not make this chage, contact support immediately.',
    ].join('\n');

    await this.queueSms(event, message, 'login method changed');
  }

  private async queueSms(
    event: AuthNotificationEvent,
    message: string,
    eventName: string,
  ): Promise<void> {
    const phoneNumber = event.phoneNumber?.trim();

    if (!phoneNumber) {
      this.logger.warn(
        `Skipped ${eventName} SMS ${event.eventId}: phone number is unavailable`,
      );
      return;
    }

    await this.queueService.add<SmsJob>(
      QUEUE_NAMES.SMS,
      SMS_JOB_NAMES.SEND,
      {
        phoneNumber,
        message,
      },
      {
        jobId: `sms-${event.eventId}`,
      },
    );

    this.logger.log(
      `${eventName} notification ${event.eventId} queued successfully`,
    );
  }

  private parseEvent(
    payload: unknown,
    eventName: string,
  ): AuthNotificationEvent | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      this.logger.error(`Rejected invalid ${eventName} event`);
      return null;
    }

    const event = payload as Partial<AuthNotificationEvent>;

    if (
      typeof event.eventId !== 'string' ||
      !event.eventId.trim() ||
      typeof event.identityId !== 'string' ||
      !event.identityId.trim() ||
      typeof event.occurredAt !== 'string' ||
      !event.occurredAt.trim() ||
      Number.isNaN(Date.parse(event.occurredAt))
    ) {
      this.logger.error(`Rejected invalid ${eventName} event`);
      return null;
    }

    const phoneNumber =
      typeof event.phoneNumber === 'string' ? event.phoneNumber.trim() : '';

    const email =
      typeof event.email === 'string' ? event.email.trim().toLowerCase() : '';

    if (!phoneNumber && !email) {
      this.logger.error(
        `Rejected ${eventName} event ${event.eventId}: no recipient supplied`,
      );
      return null;
    }

    if (
      event.data !== undefined &&
      (!event.data ||
        typeof event.data !== 'object' ||
        Array.isArray(event.data))
    ) {
      this.logger.error(`Rejected invalid ${eventName} event data`);
      return null;
    }

    return {
      eventId: event.eventId.trim(),
      identityId: event.identityId.trim(),
      occurredAt: event.occurredAt,
      data: event.data ?? {},
      ...(phoneNumber && { phoneNumber }),
      ...(email && { email }),
    };
  }

  private getRequiredDataString(
    event: AuthNotificationEvent,
    key: string,
    eventName: string | null,
  ) {
    const value = event.data?.[key];
    if (typeof value !== 'string' || !value.trim()) {
      this.logger.error(
        `Rejected ${eventName} event ${event.eventId}: ${key} is missing`,
      );
      return null;
    }
    return value;
  }
}
