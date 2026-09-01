import { Controller } from '@nestjs/common';
import { KycNotificationService } from '../kyc-notification/kyc-notification.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from 'libs/kafka/src';

@Controller()
export class KycNotificationConsumer {
  constructor(
    private readonly kycNotificationService: KycNotificationService,
  ) {}

  @EventPattern(KAFKA_TOPICS.KYC_SUBMITTED)
  handleKycSubmitted(@Payload() payload: unknown): Promise<void> {
    return this.kycNotificationService.queueKycSubmitted(payload);
  }
}
