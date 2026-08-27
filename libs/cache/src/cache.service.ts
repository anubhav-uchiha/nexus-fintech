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
    if (value === null) {
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
    const normalizedTtl = this.normalizeTtl(ttl);
    const serialized = this.serialize(value);

    await this.redis.set(key, serialized, 'EX', normalizedTtl);
  }

  async del(...keys: string[]): Promise<number> {
    const validKeys = keys.filter(
      (key) => typeof key === 'string' && key.trim().length > 0,
    );
    if (!validKeys.length) {
      return 0;
    }
    return this.redis.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const normalizedTtl = this.normalizeTtl(ttl);
    return (await this.redis.expire(key, normalizedTtl)) === 1;
  }

  async increment(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async decrement(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  async incrementWithExpiry(key: string, ttl: number): Promise<number> {
    const normalizedTtl = this.normalizeTtl(ttl);
    const script = `
    local current = redis.call('INCR', KEYS[1]) 
    if current == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return current`;
    const result = await this.redis.eval(
      script,
      1,
      key,
      normalizedTtl.toString(),
    );
    return Number(result);
  }

  async keys(pattern: string): Promise<string[]> {
    const matchingKeys: string[] = [];
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
      matchingKeys.push(...batch);
    } while (cursor !== '0');
    return matchingKeys;
  }

  async flush(): Promise<void> {
    throw new Error(
      'Flushing the entire Redis database is disabled. Use deleteByPattern() with a specific application prefix.',
    );
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<boolean> {
    const normalizedTtl = this.normalizeTtl(ttl);
    const serialized = this.serialize(value);

    const result = await this.redis.set(
      key,
      serialized,
      'EX',
      normalizedTtl,
      'NX',
    );

    return result === 'OK';
  }

  async setIfNoExists(
    key: string,
    value: unknown,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<boolean> {
    return this.setIfNotExists(key, value, ttl);
  }

  async setIfExists(
    key: string,
    value: unknown,
    ttl: number = DEFAULT_CACHE_TTL,
  ): Promise<boolean> {
    const normalizedTtl = this.normalizeTtl(ttl);

    const serialized = this.serialize(value);

    const result = await this.redis.set(
      key,
      serialized,
      'EX',
      normalizedTtl,
      'XX',
    );

    return result === 'OK';
  }

  async deleteIfValueMatches(
    key: string,
    expectedValue: string,
  ): Promise<boolean> {
    const script = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1]) else return 0
    end
    `;

    const result = await this.redis.eval(script, 1, key, expectedValue);

    return Number(result) === 1;
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

    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttl);
    }

    return fresh;
  }

  async deleteByPattern(pattern: string): Promise<number> {
    if (!pattern.trim() || pattern.trim() === '*') {
      throw new Error(
        'deleteByPattern requires a specific application key pattern.',
      );
    }

    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      cursor = nextCursor;

      if (batch.length > 0) {
        deletedCount += await this.redis.del(...batch);
      }
    } while (cursor !== '0');
    return deletedCount;
  }
  private serialize(value: unknown): string {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (serialized === undefined) {
      throw new Error('Cache value cannot be undefined');
    }
    return serialized;
  }

  private normalizeTtl(ttl: number): number {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('Cache TTL must be a positive number.');
    }
    return Math.ceil(ttl);
  }
}
