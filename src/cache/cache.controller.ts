import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Put } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { SetCacheDto } from './dto/set-cache.dto';

@Controller('cache')
export class CacheController {
  constructor(private readonly redis: RedisService) {}

  @Get(':key')
  async get(@Param('key') key: string) {
    const value = await this.redis.getJson(`cache:${key}`);
    if (value === null) throw new NotFoundException();
    return { key, value };
  }

  @Put(':key')
  @HttpCode(204)
  async set(@Param('key') key: string, @Body() dto: SetCacheDto) {
    await this.redis.setJson(`cache:${key}`, dto.value, dto.ttl);
  }

  @Delete(':key')
  @HttpCode(204)
  async remove(@Param('key') key: string) {
    await this.redis.del(`cache:${key}`);
  }
}
