import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

type Dependency = { status: 'up'; latencyMs: number } | { status: 'down' };

const probe = async (ping: () => Promise<number>): Promise<Dependency> => {
  try {
    const latencyMs = await ping();
    return { status: 'up', latencyMs: Number(latencyMs.toFixed(2)) };
  } catch {
    return { status: 'down' };
  }
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly db: DatabaseService,
  ) {}

  @Get()
  async check() {
    const [redis, postgres] = await Promise.all([probe(() => this.redis.ping()), probe(() => this.db.ping())]);
    const ok = redis.status === 'up' && postgres.status === 'up';
    const body = { status: ok ? 'ok' : 'error', redis, postgres };
    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }
}
