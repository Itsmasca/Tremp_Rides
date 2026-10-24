import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/configuration';
import { REDIS, REDIS_SUB } from './redis.constants';
import { RedisService } from './redis.service';

const createClient = (config: ConfigService<AppConfig, true>, name: string) => {
  const { host, port, password, db } = config.get('redis', { infer: true });
  return new Redis({ host, port, password, db, connectionName: name, enableAutoPipelining: true });
};

@Global()
@Module({
  providers: [
    { provide: REDIS, useFactory: (c: ConfigService<AppConfig, true>) => createClient(c, 'main'), inject: [ConfigService] },
    { provide: REDIS_SUB, useFactory: (c: ConfigService<AppConfig, true>) => createClient(c, 'sub'), inject: [ConfigService] },
    RedisService,
  ],
  exports: [REDIS, REDIS_SUB, RedisService],
})
export class RedisModule {}
