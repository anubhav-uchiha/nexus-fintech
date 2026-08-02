import { Injectable } from '@nestjs/common';
import { KafkaService } from './kafka.service';

@Injectable()
export class KafkaProducerService {
  constructor(private readonly kafkaService: KafkaService) {}
  async publish(topic: string, payload: any): Promise<void> {
    await this.kafkaService.emit(topic, payload);
  }
  async request<T = any>(topic: string, payload: any): Promise<T> {
    return this.kafkaService.send<T>(topic, payload);
  }
}
