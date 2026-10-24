import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject, filter } from 'rxjs';
import { AppConfig } from '../config/configuration';
import { REDIS, REDIS_SUB } from '../redis/redis.constants';
import { EventEnvelope } from './event.types';

/** Convierte una entrada de stream [id, [k1, v1, k2, v2...]] a EventEnvelope. */
export const parseEntry = (id: string, fields: string[]): EventEnvelope => {
  const map: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) map[fields[i]] = fields[i + 1];
  return {
    id,
    type: map.type,
    payload: map.payload ? JSON.parse(map.payload) : null,
    occurredAt: map.occurredAt,
    correlationId: map.correlationId || undefined,
  };
};

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name);
  private readonly cfg: AppConfig['events'];
  private readonly live$ = new Subject<EventEnvelope>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(REDIS_SUB) private readonly subscriber: Redis,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get('events', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    // Una sola suscripción por proceso; todos los clientes SSE comparten este Subject.
    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel !== this.cfg.channel) return;
      try {
        this.live$.next(JSON.parse(message) as EventEnvelope);
      } catch (err) {
        this.logger.warn(`Mensaje live inválido: ${(err as Error).message}`);
      }
    });
    await this.subscriber.subscribe(this.cfg.channel);
  }

  /** Persiste el evento en el stream (durable) y lo difunde en vivo (pub/sub). */
  async publish<T>(type: string, payload: T, correlationId?: string): Promise<EventEnvelope<T>> {
    const occurredAt = new Date().toISOString();
    const fields = ['type', type, 'payload', JSON.stringify(payload), 'occurredAt', occurredAt];
    if (correlationId) fields.push('correlationId', correlationId);

    const id = (await this.redis.xadd(this.cfg.stream, 'MAXLEN', '~', this.cfg.maxLen, '*', ...fields)) as string;
    const event: EventEnvelope<T> = { id, type, payload, occurredAt, correlationId };
    await this.redis.publish(this.cfg.channel, JSON.stringify(event));
    return event;
  }

  /** Últimos eventos del stream, del más reciente al más antiguo. */
  async recent(count: number): Promise<EventEnvelope[]> {
    const entries = await this.redis.xrevrange(this.cfg.stream, '+', '-', 'COUNT', count);
    return entries.map(([id, fields]) => parseEntry(id, fields));
  }

  async deadLetters(count: number): Promise<EventEnvelope[]> {
    const entries = await this.redis.xrevrange(this.cfg.deadLetterStream, '+', '-', 'COUNT', count);
    return entries.map(([id, fields]) => parseEntry(id, fields));
  }

  /** Flujo en tiempo real (best-effort, sin garantía de entrega). */
  live(types?: string[]): Observable<EventEnvelope> {
    return types?.length ? this.live$.pipe(filter((e) => types.includes(e.type))) : this.live$.asObservable();
  }
}
