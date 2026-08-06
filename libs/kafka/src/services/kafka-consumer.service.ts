import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class KafkaConsumerService {
  private readonly logger = new Logger(KafkaConsumerService.name);
  log(topic: string, payload: any) {
    this.logger.log(`Topic: ${topic}`);
    this.logger.log(JSON.stringify(payload, null, 2));
  }
}
