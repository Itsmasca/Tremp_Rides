import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { PG_POOL } from './database.constants';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(PG_POOL) readonly pool: Pool) {
    // Un error en un cliente inactivo no debe tumbar el proceso.
    pool.on('error', (err) => this.logger.error(`Error en cliente inactivo del pool: ${err.message}`));
  }

  /** Consulta parametrizada (`$1, $2, ...`). Nunca concatenar valores en el SQL. */
  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const { rows } = await this.pool.query<T>(sql, params);
    return rows;
  }

  async queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /** Ejecuta `fn` dentro de una transacción; hace ROLLBACK si lanza. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<number> {
    const start = performance.now();
    await this.pool.query('SELECT 1');
    return performance.now() - start;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
