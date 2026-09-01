import { Controller } from '@nestjs/common';
import { AuthNotificationService } from '../auth-notification/auth-notification.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from 'libs/kafka/src';

@Controller()
export class AuthNotificationConsumer {
  constructor(
    private readonly authNotificationService: AuthNotificationService,
  ) {}

  @EventPattern(KAFKA_TOPICS.AUTH_CREDENTIALS_ISSED)
  handleRegistrationCredentials(@Payload() payload: unknown): Promise<void> {
    return this.authNotificationService.queueRegistrationCredentials(payload);
  }

  @EventPattern(KAFKA_TOPICS.USER_PASSWORD_CHANGED)
  handlePasswordChanged(@Payload() payload: unknown): Promise<void> {
    return this.authNotificationService.queuePasswordChanged(payload);
  }

  @EventPattern(KAFKA_TOPICS.USER_MPIN_CHANGED)
  handleMpinChanged(@Payload() payload: unknown): Promise<void> {
    return this.authNotificationService.queueMpinchanged(payload);
  }

  @EventPattern(KAFKA_TOPICS.USER_PASSWORD_RESET)
  handlePasswordReset(@Payload() payload: unknown): Promise<void> {
    return this.authNotificationService.queuePasswordReset(payload);
  }

  @EventPattern(KAFKA_TOPICS.USER_LOGIN_METHOD_CHANGED)
  handleLoginMethodChanged(@Payload() payload: unknown): Promise<void> {
    return this.authNotificationService.queueLoginMethodChanged(payload);
  }
}
