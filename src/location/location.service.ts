import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { RedisService } from '../redis/redis.service';
import { SetLocationDto } from './dto/set-location.dto';

/** Representación almacenada de la ubicación (solo en Redis, con TTL). */
export interface StoredLocation {
  lat: number;
  lng: number;
  /** Momento de registro (epoch ms), útil para el cliente. */
  actualizadaEn: number;
}

@Injectable()
export class LocationService {
  private readonly defaultTtlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.defaultTtlSeconds = config.get('location.ttlSeconds', { infer: true });
  }

  /** Key temporal en Redis. La ubicación jamás toca PostgreSQL. */
  private key(userId: string): string {
    return `ubicacion_actual:${userId}`;
  }

  /** Guarda la ubicación con TTL; expira sola (privacidad por diseño). */
  async set(userId: string, dto: SetLocationDto): Promise<StoredLocation> {
    const ttl = dto.ttlSeconds ?? this.defaultTtlSeconds;
    const value: StoredLocation = { lat: dto.lat, lng: dto.lng, actualizadaEn: Date.now() };
    await this.redis.setJson(this.key(userId), value, ttl);
    return value;
  }

  /** Devuelve la ubicación vigente o null si expiró / nunca se registró. */
  async get(userId: string): Promise<StoredLocation | null> {
    return this.redis.getJson<StoredLocation>(this.key(userId));
  }

  /** Borrado explícito (p. ej. el usuario "deja de compartir"). */
  async clear(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }
}
