import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { AppConfig } from '../config/configuration';
import { PG_POOL } from './database.constants';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { host, port, user, password, database, poolMax, idleTimeoutMs } = config.get('database', { infer: true });
        return new Pool({
          host,
          port,
          user,
          password,
          database,
          max: poolMax,
          idleTimeoutMillis: idleTimeoutMs,
          application_name: 'trempapp',
        });
      },
      inject: [ConfigService],
    },
    DatabaseService,
  ],
  exports: [PG_POOL, DatabaseService],
})
export class DatabaseModule {}
