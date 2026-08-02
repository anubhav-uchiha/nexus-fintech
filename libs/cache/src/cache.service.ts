import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_CACHE_TTL, REDIS_CLIENT } from './constants/cache.constants';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    await this.redis.set(key, serialized, 'EX', ttl);
  }

  async del(...keys: string[]) {
    if (!keys.length) return 0;
    await this.redis.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    return (await this.redis.expire(key, ttl)) === 1;
  }

  async increment(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async decrement(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  async flush(): Promise<void> {
    await this.redis.flushdb();
  }

  async setIfNoExists(
    key: string,
    value: unknown,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<boolean> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    const result = await this.redis.set(key, serialized, 'EX', ttl, 'NX');

    return result === 'OK';
  }

  async setIfExists(
    key: string,
    value: unknown,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<boolean> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    const result = await this.redis.set(key, serialized, 'EX', ttl, 'XX');

    return result === 'OK';
  }

  async remember<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const fresh = await callback();

    await this.set(key, fresh, ttl);

    return fresh;
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(pattern);
    if (!keys.length) {
      return 0;
    }
    return this.redis.del(...keys);
  }
}
