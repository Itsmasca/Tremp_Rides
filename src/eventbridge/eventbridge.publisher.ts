import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { EventEnvelope } from '../events/event.types';
import { EVENTBRIDGE_CLIENT, MAX_BATCH_BYTES, MAX_BATCH_ENTRIES } from './eventbridge.constants';

interface Pending {
  entry: PutEventsRequestEntry;
  bytes: number;
  resolve: () => void;
  reject: (err: Error) => void;
}

/** Tamaño según las reglas de EventBridge (Time cuenta 14 bytes). */
const entrySize = (entry: PutEventsRequestEntry): number =>
  14 +
  Buffer.byteLength(entry.Source ?? '') +
  Buffer.byteLength(entry.DetailType ?? '') +
  Buffer.byteLength(entry.Detail ?? '') +
  (entry.Resources ?? []).reduce((n, r) => n + Buffer.byteLength(r), 0);

/**
 * Micro-batcher de PutEvents: agrupa hasta 10 entradas / 256 KB o espera `flushMs`.
 * Cada `send` se resuelve o rechaza según el resultado de SU entrada (PutEvents es parcial).
 */
@Injectable()
export class EventBridgePublisher implements OnApplicationShutdown {
  private readonly logger = new Logger(EventBridgePublisher.name);
  private readonly cfg: AppConfig['eventBridge'];
  private queue: Pending[] = [];
  private queuedBytes = 0;
  private timer?: NodeJS.Timeout;
  private readonly inflight = new Set<Promise<void>>();
  private closed = false;

  constructor(
    @Inject(EVENTBRIDGE_CLIENT) private readonly client: EventBridgeClient,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get('eventBridge', { infer: true });
  }

  send(event: EventEnvelope): Promise<void> {
    if (this.closed) return Promise.reject(new Error('EventBridgePublisher cerrado'));

    const entry: PutEventsRequestEntry = {
      EventBusName: this.cfg.busName,
      Source: this.cfg.source,
      DetailType: event.type,
      Time: new Date(event.occurredAt),
      Detail: JSON.stringify(event),
    };
    const bytes = entrySize(entry);
    if (bytes > MAX_BATCH_BYTES) {
      return Promise.reject(new Error(`Evento ${event.id} excede ${MAX_BATCH_BYTES} bytes (${bytes})`));
    }

    return new Promise<void>((resolve, reject) => {
      if (this.queuedBytes + bytes > MAX_BATCH_BYTES) this.flush();
      this.queue.push({ entry, bytes, resolve, reject });
      this.queuedBytes += bytes;

      if (this.queue.length >= MAX_BATCH_ENTRIES) this.flush();
      else this.timer ??= setTimeout(() => this.flush(), this.cfg.flushMs);
    });
  }

  /** Envía la cola actual como un lote (la cola nunca supera los límites de un PutEvents). */
  private flush(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.queue.length) return;

    const batch = this.queue;
    this.queue = [];
    this.queuedBytes = 0;

    const request = this.put(batch).finally(() => this.inflight.delete(request));
    this.inflight.add(request);
  }

  private async put(batch: Pending[]): Promise<void> {
    try {
      const { Entries = [] } = await this.client.send(new PutEventsCommand({ Entries: batch.map((p) => p.entry) }));
      batch.forEach((p, i) => {
        const result = Entries[i];
        if (result?.EventId && !result.ErrorCode) p.resolve();
        else p.reject(new Error(`EventBridge rechazó la entrada: ${result?.ErrorCode ?? 'sin resultado'} ${result?.ErrorMessage ?? ''}`.trim()));
      });
    } catch (err) {
      this.logger.error(`PutEvents falló (${batch.length} entradas): ${(err as Error).message}`);
      batch.forEach((p) => p.reject(err as Error));
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.closed = true;
    this.flush();
    await Promise.allSettled([...this.inflight]);
    this.client.destroy();
  }
}
