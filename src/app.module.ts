import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './cache/cache.module';
import { configuration } from './config/configuration';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration] }),
    RedisModule,
    EventsModule,
    CacheModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
