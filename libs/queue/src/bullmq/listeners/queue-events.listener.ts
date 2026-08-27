import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { QUEUE_NAMES } from '../constants/bullmq.constants';

@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueEventsListener.name);
  private readonly listeners: QueueEvents[] = [];
  constructor(private readonly configService: ConfigService) {}
  async onModuleInit(): Promise<void> {
    const queueNames = Object.values(QUEUE_NAMES);
    const host = this.configService.get<string>('redis.host') ?? 'localhost';
    const port = this.configService.get<number>('redis.port') ?? 6379;
    const password =
      this.configService.get<string>('redis.password') || undefined;
    const prefix = this.configService.get<string>('bullmq.prefix') ?? 'nexus';

    for (const queueName of queueNames) {
      const events = new QueueEvents(queueName, {
        connection: {
          host,
          port,
          ...(password && {
            password,
          }),
        },
        prefix,
      });

      events.on('completed', ({ jobId }) => {
        this.logger.log(`${queueName} Job ${jobId} completed`);
      });

      events.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(`${queueName} Job ${jobId} failed: ${failedReason}`);

        this.logger.error(failedReason);
      });

      events.on('stalled', ({ jobId }) => {
        this.logger.warn(`${queueName} Job ${jobId} stalled`);
      });

      events.on('waiting', ({ jobId }) => {
        this.logger.log(`${queueName} Job ${jobId} waiting`);
      });
      events.on('error', (error: Error) => {
        this.logger.error(
          `${queueName} queue listener error: ${error.message}`,
        );
      });

      await events.waitUntilReady();

      this.listeners.push(events);
    }
  }
  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(
      this.listeners.map((listener) => listener.close()),
    );
  }
}
