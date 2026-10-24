import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { PreferencesController } from './preferences.controller';
import { PreferencesRepository } from './preferences.repository';
import { PreferencesService } from './preferences.service';

@Module({
  imports: [
    DatabaseModule, // provee DatabaseService (global, pero se importa para claridad)
    RedisModule,    // provee el cliente REDIS ioredis
  ],
  controllers: [PreferencesController],
  providers: [PreferencesService, PreferencesRepository],
})
export class PreferencesModule {}
