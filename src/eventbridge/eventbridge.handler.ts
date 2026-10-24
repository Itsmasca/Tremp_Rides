import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { ANY_EVENT, EventHandler } from '../events/decorators/event-handler.decorator';
import { EventEnvelope } from '../events/event.types';
import { EventBridgePublisher } from './eventbridge.publisher';

/** `trip.*` => prefijo `trip.`; cualquier otro valor => tipo exacto. */
const matcher = (patterns: string[]) => {
  if (!patterns.length) return () => true;
  const exact = new Set(patterns.filter((p) => !p.endsWith('*')));
  const prefixes = patterns.filter((p) => p.endsWith('*')).map((p) => p.slice(0, -1));
  return (type: string) => exact.has(type) || prefixes.some((p) => type.startsWith(p));
};

/**
 * Reenvía eventos del stream a EventBridge. Si el envío falla, lanza:
 * el evento no se confirma y se reintenta / acaba en la DLQ (spec 001).
 */
@Injectable()
export class EventBridgeHandler {
  private readonly shouldForward: (type: string) => boolean;

  constructor(
    private readonly publisher: EventBridgePublisher,
    config: ConfigService<AppConfig, true>,
  ) {
    this.shouldForward = matcher(config.get('eventBridge.types', { infer: true }));
  }

  @EventHandler(ANY_EVENT)
  async handle(event: EventEnvelope): Promise<void> {
    if (this.shouldForward(event.type)) await this.publisher.send(event);
  }
}
