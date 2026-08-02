import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueEvents } from 'bullmq';

@Injectable()
export class QueueEventsListener implements OnModuleInit {
  private readonly logger = new Logger(QueueEventsListener.name);

  async onModuleInit() {
    const queues = ['otp', 'email', 'sms', 'notification'];

    for (const queue of queues) {
      const events = new QueueEvents(queue, {
        connection: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
        },
      });

      events.on('completed', ({ jobId }) => {
        this.logger.log(`${queue} Job ${jobId} completed`);
      });

      events.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(`${queue} Job ${jobId} failed`);

        this.logger.error(failedReason);
      });

      events.on('stalled', ({ jobId }) => {
        this.logger.warn(`${queue} Job ${jobId} stalled`);
      });

      events.on('waiting', ({ jobId }) => {
        this.logger.log(`${queue} Job ${jobId} waiting`);
      });
    }
  }
}
