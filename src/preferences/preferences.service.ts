import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.constants';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesRepository } from './preferences.repository';
import { PreferencesUpdatedEnvelope } from './preferences.types';

/**
 * Stream de destino para matching-py.
 *
 * IMPORTANTE: este stream es DISTINTO al stream interno de Trempapp
 * (trempapp:events). matching-py consume de rides.events directamente.
 * Se configura con la variable de entorno RIDES_EVENTS_STREAM.
 */
const RIDES_EVENTS_STREAM = process.env.RIDES_EVENTS_STREAM ?? 'rides.events';
const RIDES_EVENTS_MAXLEN = 200_000;

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    private readonly repo: PreferencesRepository,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Actualiza las preferencias del usuario y publica el evento en rides.events.
   *
   * Flujo:
   * 1. UPDATE en Postgres (pref_sexo_viaje + raw_text + preferences_revision++)
   * 2. XADD en rides.events con el envelope que matching-py espera
   *
   * Nota sobre consistencia: si el proceso cae entre el UPDATE y el XADD,
   * el evento se pierde (best-effort). Para consistencia fuerte se necesitaría
   * el patrón outbox transaccional — ese es el siguiente paso si se requiere.
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<void> {
    // 1. Persistir en Postgres
    const { revision } = await this.repo.updatePreferences(
      userId,
      dto.prefSexoViaje,
      dto.rawText,
    );

    // 2. Construir envelope con el contrato que matching-py espera
    const occurredAt = new Date().toISOString();
    const envelope: PreferencesUpdatedEnvelope = {
      id: randomUUID(),
      type: 'preferences.updated',
      version: 1,
      source: 'crud-ts',
      aggregateType: 'user',
      aggregateId: userId,
      occurredAt,
      data: {
        userId,
        revision,
        rawText: dto.rawText,
      },
    };

    // 3. Publicar en rides.events (el stream que consume matching-py)
    await this.redis.xadd(
      RIDES_EVENTS_STREAM,
      'MAXLEN', '~', RIDES_EVENTS_MAXLEN,
      '*',
      'envelope', JSON.stringify(envelope),
    );

    this.logger.log(
      `preferences.updated publicado | userId=${userId} revision=${revision} stream=${RIDES_EVENTS_STREAM}`,
    );
  }

  /** Devuelve las preferencias actuales (para GET). */
  async getPreferences(userId: string) {
    return this.repo.findByUserId(userId);
  }
}
