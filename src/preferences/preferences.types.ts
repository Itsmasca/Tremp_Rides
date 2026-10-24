/**
 * Payload del evento preferences.updated publicado en el stream rides.events.
 *
 * Este contrato está definido aquí (crud-ts) y NO debe modificarse
 * sin coordinar con matching-py, que lo consume.
 *
 * Campo revision: número monotónico creciente usado por matching-py
 * para garantizar idempotencia y orden de procesamiento.
 */
export interface PreferencesUpdatedPayload {
  userId: string;
  revision: number;
  rawText: string;
}

/**
 * Envelope completo que se escribe en el Redis Stream.
 * Coincide con el contrato que espera matching-py.
 */
export interface PreferencesUpdatedEnvelope {
  id: string;               // UUID generado aquí
  type: 'preferences.updated';
  version: 1;
  source: 'crud-ts';
  aggregateType: 'user';
  aggregateId: string;      // userId
  occurredAt: string;       // ISO-8601
  data: PreferencesUpdatedPayload;
}
