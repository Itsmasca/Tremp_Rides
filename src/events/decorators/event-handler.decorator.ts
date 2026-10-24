import { SetMetadata } from '@nestjs/common';

export const EVENT_HANDLER_METADATA = 'trempapp:event-handler';
export const ANY_EVENT = '*';

/**
 * Marca un método de un provider como handler de uno o más tipos de evento.
 * Usa `@EventHandler(ANY_EVENT)` para recibir todos.
 * Si el método lanza, el evento no se confirma (ACK) y se reintenta.
 */
export const EventHandler = (...types: string[]) => SetMetadata(EVENT_HANDLER_METADATA, types);
