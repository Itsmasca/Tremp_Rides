import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/configuration';
import { REDIS, REDIS_SUB } from './redis.constants';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly prefix: string;
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(REDIS) readonly client: Redis,
    @Inject(REDIS_SUB) private readonly subscriber: Redis,
    config: ConfigService<AppConfig, true>,
  ) {
    this.prefix = config.get('redis.prefix', { infer: true });
  }

  key(key: string): string {
    return this.prefix + key;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(this.key(key));
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (ttlSeconds) await this.client.set(this.key(key), raw, 'EX', ttlSeconds);
    else await this.client.set(this.key(key), raw);
  }

  async del(...keys: string[]): Promise<number> {
    return keys.length ? this.client.unlink(...keys.map((k) => this.key(k))) : 0;
  }

  /**
   * Cache-aside: devuelve el valor cacheado o ejecuta el loader una sola vez
   * por proceso (deduplica llamadas concurrentes a la misma key).
   */
  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = loader()
      .then(async (value) => {
        await this.setJson(key, value, ttlSeconds);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  async ping(): Promise<number> {
    const start = performance.now();
    await this.client.ping();
    return performance.now() - start;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}
