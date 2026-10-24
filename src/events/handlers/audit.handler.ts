import { Injectable, Logger } from '@nestjs/common';
import { ANY_EVENT, EventHandler } from '../decorators/event-handler.decorator';
import { EventEnvelope } from '../event.types';

/** Handler de ejemplo: registra todos los eventos. Copia este patrón para tus dominios. */
@Injectable()
export class AuditHandler {
  private readonly logger = new Logger(AuditHandler.name);

  @EventHandler(ANY_EVENT)
  handle(event: EventEnvelope): void {
    this.logger.log(`${event.type} ${event.id}`);
  }
}
