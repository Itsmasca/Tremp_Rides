/** Cliente EventBridge (AWS SDK v3). Sólo existe si EVENTBRIDGE_ENABLED=true. */
export const EVENTBRIDGE_CLIENT = Symbol('EVENTBRIDGE_CLIENT');

/** Límites de PutEvents: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-putevent-size.html */
export const MAX_BATCH_ENTRIES = 10;
export const MAX_BATCH_BYTES = 256 * 1024;
