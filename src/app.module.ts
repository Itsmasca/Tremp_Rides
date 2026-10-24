import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { CacheModule } from './cache/cache.module';
import { bool, configuration } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { EventBridgeModule } from './eventbridge/eventbridge.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';
import { LocationModule } from './location/location.module';
import { PreferencesModule } from './preferences/preferences.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration] }),
    RedisModule,
    DatabaseModule,
    EventsModule,
    CacheModule,
    LocationModule,
    PreferencesModule,
    UsersModule,
    ConditionalModule.registerWhen(EventBridgeModule, (env) => bool(env.EVENTBRIDGE_ENABLED)),
  ],
  controllers: [HealthController],
})
export class AppModule {}
