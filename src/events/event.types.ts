export interface EventEnvelope<T = unknown> {
  /** ID del stream de Redis (ordenable, único). */
  id: string;
  type: string;
  payload: T;
  occurredAt: string;
  correlationId?: string;
}
