import { hostname } from 'node:os';

const int = (value: string | undefined, fallback: number): number => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
};

export const configuration = () => {
  const prefix = process.env.REDIS_PREFIX ?? 'trempapp:';
  const stream = `${prefix}${process.env.EVENTS_STREAM ?? 'events'}`;

  return {
    port: int(process.env.PORT, 3000),
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: int(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: int(process.env.REDIS_DB, 0),
      prefix,
    },
    events: {
      stream,
      deadLetterStream: `${stream}:dlq`,
      channel: `${stream}:live`,
      group: process.env.EVENTS_GROUP ?? 'trempapp',
      consumer: process.env.EVENTS_CONSUMER ?? `${hostname()}-${process.pid}`,
      maxLen: int(process.env.EVENTS_MAXLEN, 100_000),
      batchSize: int(process.env.EVENTS_BATCH, 100),
      blockMs: int(process.env.EVENTS_BLOCK_MS, 5_000),
      maxDeliveries: int(process.env.EVENTS_MAX_DELIVERIES, 5),
      claimIdleMs: int(process.env.EVENTS_CLAIM_IDLE_MS, 30_000),
    },
  };
};

export type AppConfig = ReturnType<typeof configuration>;
