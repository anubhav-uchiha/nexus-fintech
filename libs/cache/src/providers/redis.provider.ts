import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../constants/cache.constants';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,

  inject: [ConfigService],

  useFactory: (configService: ConfigService) => {
    const client = new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      password: configService.get<string>('redis.password') || undefined,

      lazyConnect: true,

      maxRetriesPerRequest: null,

      enableReadyCheck: true,

      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });

    client.on('connect', () => {
      console.log('✅ Redis Connected');
    });

    client.on('error', (error) => {
      console.error('❌ Redis Error:', error.message);
    });

    return client;
  },
};
