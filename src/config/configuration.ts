import { hostname } from 'node:os';

export const bool = (value: string | undefined): boolean => /^(1|true|yes)$/i.test(value ?? '');

const list = (value: string | undefined): string[] =>
  (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);

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
    database: {
      host: process.env.DB_HOST ?? 'localhost',
      port: int(process.env.DB_PORT, 5432),
      user: process.env.DB_USER ?? 'trempapp',
      password: process.env.DB_PASSWORD ?? 'trempapp',
      database: process.env.DB_NAME ?? 'trempapp',
      poolMax: int(process.env.DB_POOL_MAX, 10),
      idleTimeoutMs: int(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
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
    eventBridge: {
      enabled: bool(process.env.EVENTBRIDGE_ENABLED),
      region: process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.EVENTBRIDGE_ENDPOINT || undefined,
      busName: process.env.EVENTBRIDGE_BUS ?? 'trempapp',
      source: process.env.EVENTBRIDGE_SOURCE ?? 'trempapp.backend',
      types: list(process.env.EVENTBRIDGE_TYPES),
      flushMs: int(process.env.EVENTBRIDGE_FLUSH_MS, 50),
    },
  };
};

export type AppConfig = ReturnType<typeof configuration>;
