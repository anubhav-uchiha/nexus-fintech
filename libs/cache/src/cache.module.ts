import { Global, Module } from '@nestjs/common';

import { AppConfigModule } from '@nexus/config';

import { CacheService } from './cache.service';
import { RedisProvider } from './providers/redis.provider';

@Global()
@Module({
  imports: [AppConfigModule],

  providers: [RedisProvider, CacheService],

  exports: [CacheService, RedisProvider],
})
export class CacheModule {}
