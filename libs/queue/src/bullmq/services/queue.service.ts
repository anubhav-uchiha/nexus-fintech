import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../constants/bullmq.constants';
import { Job, JobsOptions, Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

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

  private getQueue(queueName: string): Queue {
    switch (queueName) {
      case QUEUE_NAMES.OTP:
        return this.otpQueue;
      case QUEUE_NAMES.EMAIL:
        return this.emailQueue;
      case QUEUE_NAMES.SMS:
        return this.smsQueue;
      case QUEUE_NAMES.NOTIFICATION:
        return this.notificationQueue;
      default:
        throw new Error(`Queue "${queueName}" not found`);
    }
  }

  private isSensitiveQueue(queueName: string): boolean {
    return (
      queueName === QUEUE_NAMES.OTP ||
      queueName === QUEUE_NAMES.EMAIL ||
      queueName === QUEUE_NAMES.SMS
    );
  }

  async add<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    if (!jobName.trim()) {
      throw new Error('Queue job name cannot be empty');
    }
    const queue = this.getQueue(queueName);
    const jobOptions: JobsOptions = {
      attempts: 3,

      backoff: {
        type: 'exponential',
        delay: 5000,
      },

      removeOnComplete: {
        age: 3600,
        count: 100,
      },

      removeOnFail: {
        age: 24 * 60 * 60,
        count: 100,
      },

      ...options,
    };
    if (this.isSensitiveQueue(queueName)) {
      jobOptions.removeOnComplete = true;
      jobOptions.removeOnFail = true;
    }
    const createdJob = await queue.add(jobName, data, jobOptions);

    this.logger.log(
      `Added job ${createdJob.id} to queue ${queueName}: ${jobName}`,
    );
    return createdJob;
  }

  async getJob(queueName: string, jobId: string) {
    return this.getQueue(queueName).getJob(jobId);
  }

  async remove(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);

    if (!job) {
      return false;
    }
    await job.remove();
    return true;
  }

  async getWaiting(queueName: string) {
    return this.getQueue(queueName).getWaiting();
  }

  async getActive(queueName: string) {
    return this.getQueue(queueName).getActive();
  }

  async getDelayed(queueName: string) {
    return this.getQueue(queueName).getDelayed();
  }

  async getCompleted(queueName: string) {
    return this.getQueue(queueName).getCompleted();
  }
  async getFailed(queueName: string) {
    return this.getQueue(queueName).getFailed();
  }

  async grtFailed(queueName: string) {
    return this.getFailed(queueName);
  }

  async pause(queueName: string) {
    return this.getQueue(queueName).pause();
  }

  async resume(queueName: string) {
    return this.getQueue(queueName).resume();
  }

  async clean(
    queueName: string,
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
    return this.getQueue(queueName).clean(grace, limit, type);
  }

  async getJobCounts(queueName: string) {
    return this.getQueue(queueName).getJobCounts();
  }
}
