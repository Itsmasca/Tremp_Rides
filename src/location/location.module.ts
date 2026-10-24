import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

/**
 * Gestión de la ubicación efímera del usuario (Redis + TTL).
 * RedisModule es @Global(), por eso no hace falta importarlo aquí.
 */
@Module({
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
