import { Injectable, Logger } from '@nestjs/common';
import {
  QUEUE_NAMES,
  QueueService,
  SMS_JOB_NAMES,
  SmsJob,
} from 'libs/queue/src';
import { NotificationRecipientService } from '../auth-notification/notification-recipient.service';
import { KycNotificationEvent } from 'libs/kafka/src';

@Injectable()
export class KycNotificationService {
  private readonly logger = new Logger(KycNotificationService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly recipientservice: NotificationRecipientService,
  ) {}
  async queueKycSubmitted(payload: unknown): Promise<void> {
    const event = this.parseEvent(payload, 'KYC submitted');

    if (!event) {
      return;
    }

    const recipient = await this.recipientservice.resolve(event.identityId);

    if (!recipient.phoneNumber) {
      this.logger.warn(
        `KYC submitted notification ${event.eventId} skipped: no verified phone number`,
      );

      return;
    }

    const message = [
      'UmiPay KYC Update',
      '',
      'Your KYC has been submitted successfully and is now under review.',
      'You will be notified after the review is completed.',
    ].join('\n');

    await this.queueService.add<SmsJob>(
      QUEUE_NAMES.SMS,
      SMS_JOB_NAMES.SEND,
      {
        phoneNumber: recipient.phoneNumber,
        message,
      },
      {
        jobId: `sms-${event.eventId}`,
      },
    );

    this.logger.log(
      `KYC submitted notification ${event.eventId} queued successfully`,
    );
  }

  private parseEvent(
    payload: unknown,
    eventName: string,
  ): KycNotificationEvent | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      this.logger.error(`Rejected invalid ${eventName} event`);
      return null;
    }

    const event = payload as Partial<KycNotificationEvent>;

    if (
      typeof event.eventId !== 'string' ||
      !event.eventId.trim() ||
      typeof event.identityId !== 'string' ||
      !event.identityId.trim() ||
      typeof event.kycId !== 'string' ||
      !event.kycId.trim() ||
      typeof event.occurredAt !== 'string' ||
      !event.occurredAt.trim() ||
      Number.isNaN(Date.parse(event.occurredAt))
    ) {
      this.logger.error(`Rejected invalid ${eventName} event`);
      return null;
    }

    return {
      eventId: event.eventId.trim(),
      identityId: event.identityId.trim(),
      kycId: event.kycId.trim(),
      occurredAt: event.occurredAt,
      ...(typeof event.reasonCode === 'string' &&
        event.reasonCode.trim() && {
          reasonCode: event.reasonCode.trim(),
        }),
    };
  }
}
