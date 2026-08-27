import * as argon2 from 'argon2';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PasswordWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  settled: boolean;
}

@Injectable()
export class PasswordService {
  private activeOperations = 0;
  private readonly waitingOperations: PasswordWaiter[] = [];
  private readonly maxConcurrency: number;
  private readonly maxQueueSize: number;
  private readonly queueTimeoutMs: number;
  constructor(private readonly configService: ConfigService) {
    this.maxConcurrency = this.getPositiveInteger(
      'AUTH_PASSWORD_MAX_CONCURRENCY',
      4,
    );

    this.maxQueueSize = this.getPositiveInteger(
      'AUTH_PASSWORD_MAX_QUEUE_SIZE',
      200,
    );

    this.queueTimeoutMs = this.getPositiveInteger(
      'AUTH_PASSWORD_QUEUE_TIMEOUT_MS',
      5000,
    );
  }
  async hash(password: string): Promise<string> {
    return this.runProtected(() => argon2.hash(password));
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return this.runProtected(() => argon2.verify(hash, password));
  }

  private async runProtected<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.activeOperations < this.maxConcurrency) {
      this.activeOperations += 1;
      return Promise.resolve();
    }
    if (this.waitingOperations.length >= this.maxQueueSize) {
      return Promise.reject(this.createBusyException());
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {} as PasswordWaiter;
      waiter.resolve = resolve;
      waiter.reject = reject;
      waiter.settled = false;
      waiter.timer = setTimeout(() => {
        if (waiter.settled) {
          return;
        }
        waiter.settled = true;

        const waiterIndex = this.waitingOperations.indexOf(waiter);
        if (waiterIndex >= 0) {
          this.waitingOperations.splice(waiterIndex, 1);
        }
        reject(this.createBusyException());
      }, this.queueTimeoutMs);
      this.waitingOperations.push(waiter);
    });
  }

  private release(): void {
    const nextWaiter = this.waitingOperations.shift();

    if (nextWaiter) {
      nextWaiter.settled = true;
      clearTimeout(nextWaiter.timer);
      nextWaiter.resolve();
      return;
    }

    this.activeOperations = Math.max(0, this.activeOperations - 1);
  }

  private createBusyException(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'Authentication service is busy. Please try again shortly.',
    );
  }

  private getPositiveInteger(key: string, fallback: number): number {
    const value = Number(
      this.configService.get<string | number>(key) ?? fallback,
    );
    if (!Number.isInteger(value) || value <= 0) {
      return fallback;
    }
    return value;
  }
}
