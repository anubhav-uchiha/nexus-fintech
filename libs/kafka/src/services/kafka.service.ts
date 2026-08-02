import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KafkaService implements OnModuleInit {
  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientKafka,
  ) {}
  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async emit(topic: string, payload: any): Promise<void> {
    await firstValueFrom(this.kafkaClient.emit(topic, payload));
  }
  async send<T = any>(topic: string, payload: any): Promise<T> {
    return firstValueFrom(this.kafkaClient.send<T>(topic, payload));
  }
  getClient(): ClientKafka {
    return this.kafkaClient;
  }
}
