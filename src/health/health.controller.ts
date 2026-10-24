import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisService) {}

  @Get()
  async check() {
    try {
      const latencyMs = await this.redis.ping();
      return { status: 'ok', redis: { status: 'up', latencyMs: Number(latencyMs.toFixed(2)) } };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', redis: { status: 'down' } });
    }
  }
}
