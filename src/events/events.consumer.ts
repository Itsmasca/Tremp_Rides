import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { setTimeout as sleep } from 'node:timers/promises';
import { AppConfig } from '../config/configuration';
import { REDIS } from '../redis/redis.constants';
import { EventHandlerRegistry } from './event-handler.registry';
import { parseEntry } from './events.service';

type StreamEntry = [id: string, fields: string[] | null];
type XReadReply = [stream: string, entries: StreamEntry[]][] | null;
type XPendingEntry = [id: string, consumer: string, idleMs: number, deliveries: number];

/**
 * Consumidor de Redis Streams con consumer group:
 * - at-least-once: ACK sólo si todos los handlers terminan bien.
 * - reintentos: mensajes pendientes con idle > claimIdleMs se reclaman.
 * - DLQ: tras maxDeliveries intentos se mueven a `<stream>:dlq`.
 * Escala horizontalmente: cada instancia es un consumer distinto del mismo grupo.
 */
@Injectable()
export class EventsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(EventsConsumer.name);
  private readonly cfg: AppConfig['events'];
  private conn: Redis;
  private running = false;
  private loop?: Promise<void>;
  private lastReclaim = 0;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly registry: EventHandlerRegistry,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get('events', { infer: true });
  }

  async onApplicationBootstrap(): Promise<void> {
    // Conexión propia: XREADGROUP BLOCK bloquea la conexión.
    this.conn = this.redis.duplicate({ connectionName: 'consumer', enableAutoPipelining: false, maxRetriesPerRequest: null });
    await this.ensureGroup();
    this.running = true;
    this.loop = this.run();
    this.logger.log(`Consumiendo ${this.cfg.stream} como ${this.cfg.group}/${this.cfg.consumer}`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    this.conn?.disconnect(); // corta el BLOCK en curso
    await this.loop;
  }

  private async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.cfg.stream, this.cfg.group, '0', 'MKSTREAM');
    } catch (err) {
      if (!(err as Error).message.includes('BUSYGROUP')) throw err;
    }
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        if (Date.now() - this.lastReclaim >= this.cfg.claimIdleMs) {
          this.lastReclaim = Date.now();
          await this.reclaim();
        }

        const reply = (await this.conn.xreadgroup(
          'GROUP', this.cfg.group, this.cfg.consumer,
          'COUNT', this.cfg.batchSize,
          'BLOCK', this.cfg.blockMs,
          'STREAMS', this.cfg.stream, '>',
        )) as XReadReply;

        if (reply) await this.process(reply[0][1]);
      } catch (err) {
        if (!this.running) break;
        const message = (err as Error).message;
        if (message.includes('NOGROUP')) await this.ensureGroup().catch(() => undefined);
        else {
          this.logger.error(`Error en el loop de consumo: ${message}`);
          await sleep(1_000);
        }
      }
    }
  }

  /** Procesa un lote en paralelo y confirma en un solo XACK los que tuvieron éxito. */
  private async process(entries: StreamEntry[]): Promise<void> {
    const results = await Promise.allSettled(
      entries.map(async ([id, fields]) => {
        // Entradas recortadas por MAXLEN llegan sin campos: se confirman para limpiarlas.
        if (!fields?.length) return id;
        const event = parseEntry(id, fields);
        await Promise.all(this.registry.resolve(event.type).map((handle) => handle(event)));
        return id;
      }),
    );

    const acked: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') acked.push(r.value);
      else this.logger.warn(`Evento ${entries[i][0]} falló: ${(r.reason as Error)?.message ?? r.reason}`);
    });
    if (acked.length) await this.redis.xack(this.cfg.stream, this.cfg.group, ...acked);
  }

  /** Reclama pendientes abandonados (consumer caído o handler fallido) o los manda a la DLQ. */
  private async reclaim(): Promise<void> {
    const pending = (await this.redis.xpending(
      this.cfg.stream, this.cfg.group, 'IDLE', this.cfg.claimIdleMs, '-', '+', this.cfg.batchSize,
    )) as XPendingEntry[];
    if (!pending.length) return;

    const dead = pending.filter(([, , , deliveries]) => deliveries >= this.cfg.maxDeliveries).map(([id]) => id);
    const retry = pending.filter(([, , , deliveries]) => deliveries < this.cfg.maxDeliveries).map(([id]) => id);

    if (dead.length) await this.moveToDeadLetter(dead);
    if (retry.length) {
      const claimed = (await this.redis.xclaim(
        this.cfg.stream, this.cfg.group, this.cfg.consumer, this.cfg.claimIdleMs, ...retry,
      )) as StreamEntry[];
      if (claimed.length) await this.process(claimed);
    }
  }

  private async moveToDeadLetter(ids: string[]): Promise<void> {
    const entries = await Promise.all(ids.map((id) => this.redis.xrange(this.cfg.stream, id, id)));
    const pipeline = this.redis.pipeline();
    entries.forEach(([entry], i) => {
      if (entry) {
        pipeline.xadd(this.cfg.deadLetterStream, 'MAXLEN', '~', this.cfg.maxLen, '*', ...entry[1], 'originalId', ids[i]);
      }
    });
    pipeline.xack(this.cfg.stream, this.cfg.group, ...ids);
    await pipeline.exec();
    this.logger.warn(`${ids.length} evento(s) enviados a la DLQ`);
  }
}
