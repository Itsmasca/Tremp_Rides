import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { DatabaseService } from '../../src/database/database.service';
import { MatchCandidate } from '../../src/matching/matching.types';
import { SearchRidesQueries } from '../../src/rides/search-rides/search-rides.queries';

// Mismo orden que docker-entrypoint-initdb.d en docker-compose.yml.
const MIGRATIONS = [
  'schema.sql',
  '002_add_preferences_columns.sql',
  '003_vehiculo_catalogo.sql',
  '004_trips_geo_outbox.sql',
  '005_matching_views.sql',
  'seed.sql',
];

// UPDATE exacto de matching-py (awsLionRidealghoritm/app/features/preferences/repository.py).
const MATCHING_PY_UPDATE = `
        UPDATE user_preferences
           SET structured          = $1::jsonb,
               structured_revision = $2,
               structured_at       = $3
         WHERE user_id             = $4
           AND (structured_revision IS NULL OR structured_revision < $2)`;

describe('vistas de matching-py y recorte de ruta (spec 010)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let userId: string;
  let tripId: string;

  beforeAll(async () => {
    // Imagen de infra/postgres construida por `pretest:int` (construirla aquí con Testcontainers
    // deja un stream de docker-modem abierto que revienta tras el teardown de Jest).
    container = await new PostgreSqlContainer('trempapp-postgres:test').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });

    for (const file of MIGRATIONS) await pool.query(readFileSync(join(__dirname, '../../db', file), 'utf8'));

    ({ id: userId } = (await pool.query("SELECT id FROM users WHERE correo = 'demo1@anahuac.mx'")).rows[0]);
    ({ id: tripId } = (await pool.query('SELECT id FROM trips WHERE conductor_id = $1', [userId])).rows[0]);
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('rides traduce trips al contrato de matching-py', async () => {
    const { rows } = await pool.query('SELECT driver_id, status, seats_available, max_detour_s FROM rides WHERE id = $1', [
      tripId,
    ]);
    expect(rows[0]).toEqual({ driver_id: userId, status: 'scheduled', seats_available: 2, max_detour_s: 600 });
  });

  it('el UPDATE de matching-py escribe en users a través de user_preferences, sólo con revisión mayor', async () => {
    const run = (revision: number, structured: object) =>
      pool.query(MATCHING_PY_UPDATE, [JSON.stringify(structured), revision, new Date(), userId]);

    expect((await run(3, { schema_version: 1, allow_pets: true })).rowCount).toBe(1);
    expect((await run(2, { schema_version: 1, allow_pets: false })).rowCount).toBe(0);

    const { rows } = await pool.query(
      'SELECT pref_estructuradas, pref_estructuradas_revision FROM users WHERE id = $1',
      [userId],
    );
    expect(rows[0]).toEqual({ pref_estructuradas: { schema_version: 1, allow_pets: true }, pref_estructuradas_revision: 3 });
  });

  describe('SearchRidesQueries', () => {
    const P = { lat: 21.0, lng: -89.65 };
    const D = { lat: 21.0, lng: -89.6 };
    // A → P → D → B: el conductor sale de -89.70 y llega a -89.55.
    const full = {
      type: 'LineString' as const,
      coordinates: [[-89.7, 21.0], [-89.65, 21.0], [-89.6, 21.0], [-89.55, 21.0]] as [number, number][],
    };
    const candidate = (rideId: string, pickup = P, dropoff = D): MatchCandidate => ({
      rideId,
      rank: 1,
      score: 0.9,
      detourS: 60,
      pickupEtaS: 300,
      snappedPickup: pickup,
      snappedDropoff: dropoff,
      routeGeometry: full,
    });
    let queries: SearchRidesQueries;

    beforeAll(() => {
      queries = new SearchRidesQueries(new DatabaseService(pool));
    });

    it('recorta la ruta a recogida → bajada y completa datos del conductor', async () => {
      const [row] = await queries.findCandidates([candidate(tripId)]);

      expect(row).toMatchObject({ id: tripId, nombre: 'Demo Uno', capacidad_disponible: 2 });
      expect(['M', 'F', 'otro']).toContain(row.sexo);
      expect(row.route_pd?.coordinates).toEqual([[-89.65, 21.0], [-89.6, 21.0]]);
    });

    it('recogida después de la bajada → ruta null', async () => {
      const [row] = await queries.findCandidates([candidate(tripId, D, P)]);
      expect(row.route_pd).toBeNull();
    });

    it('descarta viajes inexistentes o que ya no están pendientes', async () => {
      const ghost = '00000000-0000-0000-0000-000000000000';
      expect(await queries.findCandidates([candidate(ghost)])).toEqual([]);

      await pool.query("UPDATE trips SET estado = 'cancelado' WHERE id = $1", [tripId]);
      expect(await queries.findCandidates([candidate(tripId)])).toEqual([]);
    });
  });
});
