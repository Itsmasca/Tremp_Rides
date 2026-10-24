import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { AppConfig } from '../config/configuration';
import { REDIS } from '../redis/redis.constants';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesRepository } from './preferences.repository';
import { PreferencesUpdatedEnvelope } from './preferences.types';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);
  /**
   * Stream de destino para matching-py (`ridesEvents.stream`, por defecto rides.events).
   * IMPORTANTE: es DISTINTO al stream interno de Trempapp (trempapp:events).
   */
  private readonly ridesEvents: AppConfig['ridesEvents'];

  constructor(
    private readonly repo: PreferencesRepository,
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<AppConfig, true>,
  ) {
    this.ridesEvents = config.get('ridesEvents', { infer: true });
  }

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
      this.ridesEvents.stream,
      'MAXLEN', '~', this.ridesEvents.maxLen,
      '*',
      'envelope', JSON.stringify(envelope),
    );

    this.logger.log(
      `preferences.updated publicado | userId=${userId} revision=${revision} stream=${this.ridesEvents.stream}`,
    );
  }

  /** Devuelve las preferencias actuales (para GET). */
  async getPreferences(userId: string) {
    return this.repo.findByUserId(userId);
  }
}
