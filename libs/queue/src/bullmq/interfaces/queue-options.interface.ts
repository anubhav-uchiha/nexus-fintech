import { JobsOptions } from 'bullmq';

export interface QueueJob<T = unknown> {
  queue: string;
  job: string;
  data: T;
  options?: JobsOptions;
}
