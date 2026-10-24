import { hostname } from 'node:os';

export const bool = (value: string | undefined): boolean => /^(1|true|yes)$/i.test(value ?? '');

const list = (value: string | undefined): string[] =>
  (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);

const int = (value: string | undefined, fallback: number): number => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
};

const num = (value: string | undefined, fallback: number): number => {
  const n = Number.parseFloat(value ?? '');
  return Number.isNaN(n) ? fallback : n;
};

/** `minLng,minLat,maxLng,maxLat`. */
export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const bbox = (value: string): Bbox => {
  const [minLng, minLat, maxLng, maxLat] = value.split(',').map(Number);
  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
    throw new Error(`PENINSULA_BBOX inválido: "${value}" (esperado minLng,minLat,maxLng,maxLat)`);
  }
  return { minLng, minLat, maxLng, maxLat };
};

export const configuration = () => {
  const prefix = process.env.REDIS_PREFIX ?? 'trempapp:';
  const stream = `${prefix}${process.env.EVENTS_STREAM ?? 'events'}`;

  return {
    port: int(process.env.PORT, 3000),
    /** Orígenes del cliente web (Expo web). La app nativa no usa CORS. */
    corsOrigins: list(process.env.CORS_ORIGINS ?? 'http://localhost:8081'),
    auth: {
      jwtSecret: process.env.JWT_SECRET ?? 'cambia-esto-en-produccion',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
    },
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: int(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: int(process.env.REDIS_DB, 0),
      tls: bool(process.env.REDIS_TLS), // ElastiCache con cifrado en tránsito
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
    location: {
      // La ubicación nunca se persiste en PostgreSQL: vive solo en Redis con TTL.
      ttlSeconds: int(process.env.LOCATION_TTL_SEGUNDOS, 1800),
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
    /** Stream que consume matching-py (`preferences.updated`, `ride.created`). Distinto de `events.stream`. */
    ridesEvents: {
      stream: process.env.RIDES_EVENTS_STREAM ?? 'rides.events',
      maxLen: int(process.env.RIDES_EVENTS_MAXLEN, 200_000),
    },
    rides: {
      peninsulaBbox: bbox(process.env.PENINSULA_BBOX ?? '-90.5,19.5,-87.4,21.7'),
      maxDaysAhead: int(process.env.MAX_DAYS_AHEAD, 14),
      overlapWindowMin: int(process.env.OVERLAP_WINDOW_MIN, 60),
      routeMaxPoints: int(process.env.ROUTE_MAX_POINTS, 500),
      routeSimplifyTolerance: num(process.env.ROUTE_SIMPLIFY_TOLERANCE, 0.00005),
      routeRetentionHours: int(process.env.ROUTE_RETENTION_HOURS, 24),
      routePurgeIntervalMs: int(process.env.ROUTE_PURGE_INTERVAL_MS, 600_000),
    },
    osrm: {
      url: process.env.OSRM_URL ?? 'http://localhost:5000',
      profile: process.env.OSRM_PROFILE ?? 'driving',
      timeoutMs: int(process.env.OSRM_TIMEOUT_MS, 2_000),
    },
    outbox: {
      inline: bool(process.env.OUTBOX_INLINE ?? 'true'),
      pollMs: int(process.env.OUTBOX_POLL_MS, 500),
      batchSize: int(process.env.OUTBOX_BATCH_SIZE, 100),
      maxAttempts: int(process.env.OUTBOX_MAX_ATTEMPTS, 10),
    },
    /** matching-py (`POST /match`, spec 010). Red interna, sin auth. */
    matching: {
      url: process.env.MATCHING_URL ?? 'http://localhost:8000',
      timeoutMs: int(process.env.MATCHING_TIMEOUT_MS, 3_000),
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
