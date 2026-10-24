/** Conexión principal (comandos normales, auto-pipelining). */
export const REDIS = Symbol('REDIS');
/** Conexión dedicada a SUBSCRIBE (no puede ejecutar otros comandos). */
export const REDIS_SUB = Symbol('REDIS_SUB');
