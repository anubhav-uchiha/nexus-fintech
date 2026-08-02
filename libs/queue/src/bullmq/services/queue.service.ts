import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { QUEUE_NAMES } from '../constants/bullmq.constants';
import { Job, JobsOptions, Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.OTP)
    private readonly otpQueue: Queue,

    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: Queue,

    @InjectQueue(QUEUE_NAMES.SMS)
    private readonly smsQueue: Queue,

    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue,
  ) {}

  private getQueue(queue: string): Queue {
    switch (queue) {
      case QUEUE_NAMES.OTP:
        return this.otpQueue;
      case QUEUE_NAMES.EMAIL:
        return this.emailQueue;
      case QUEUE_NAMES.SMS:
        return this.smsQueue;
      case QUEUE_NAMES.NOTIFICATION:
        return this.notificationQueue;
      default:
        throw new Error(`Queue "${queue}" not found`);
    }
  }

  async add<T>(
    queue: string,
    job: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    return this.getQueue(queue).add(job, data, {
      attempts: 3,

      backoff: {
        type: 'exponential',
        delay: 5000,
      },

      removeOnComplete: 100,

      removeOnFail: 100,

      ...options,
    });
  }

  async getJob(queue: string, jobId: string) {
    return this.getQueue(queue).getJob(jobId);
  }

  async remove(queue: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(queue, jobId);

    if (!job) {
      return false;
    }
    await job.remove();
    return true;
  }

  async getWaiting(queue: string) {
    return this.getQueue(queue).getWaiting();
  }

  async getActive(queue: string) {
    return this.getQueue(queue).getActive();
  }

  async getDelayed(queue: string) {
    return this.getQueue(queue).getDelayed();
  }

  async getCompleted(queue: string) {
    return this.getQueue(queue).getCompleted();
  }

  async grtFailed(queue: string) {
    return this.getQueue(queue).getFailed();
  }

  async pause(queue: string) {
    return this.getQueue(queue).pause();
  }

  async resume(queue: string) {
    return this.getQueue(queue).resume();
  }

  async clean(
    queue: string,
    grace = 0,
    limit = 1000,
    type:
      | 'completed'
      | 'wait'
      | 'active'
      | 'paused'
      | 'prioritized'
      | 'delayed'
      | 'failed' = 'completed',
  ) {
    return this.getQueue(queue).clean(grace, limit, type);
  }

  async getJobCounts(queue: string) {
    return this.getQueue(queue).getJobCounts();
  }
}
