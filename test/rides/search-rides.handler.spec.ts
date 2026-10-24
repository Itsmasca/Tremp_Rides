import { BadGatewayException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configuration } from '../../src/config/configuration';
import { MatchingClient } from '../../src/matching/matching.client';
import { MatchingContractError, MatchingUnavailable } from '../../src/matching/matching.errors';
import { MatchCandidate, MatchRequest } from '../../src/matching/matching.types';
import { SearchRidesDto } from '../../src/rides/search-rides/search-rides.dto';
import { SearchRidesHandler } from '../../src/rides/search-rides/search-rides.handler';
import { SearchRideRow, SearchRidesQueries } from '../../src/rides/search-rides/search-rides.queries';

const PASSENGER = '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
const P = { lat: 21.0186, lng: -89.5847 };
const D = { lat: 20.9671, lng: -89.6237 };

const dto = (overrides: Partial<SearchRidesDto> = {}): SearchRidesDto =>
  Object.assign(new SearchRidesDto(), {
    pickup: P,
    dropoff: D,
    departureAt: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  });

const candidate = (rideId: string, rank: number): MatchCandidate => ({
  rideId,
  rank,
  score: 1 - rank / 10,
  detourS: 100 * rank,
  pickupEtaS: 300,
  snappedPickup: P,
  snappedDropoff: D,
  routeGeometry: rank === 1 ? { type: 'LineString', coordinates: [[-89.6, 21.0], [-89.5, 21.0]] } : null,
});

const row = (id: string, routePd: SearchRideRow['route_pd'] = null): SearchRideRow => ({
  id,
  salida_en: new Date('2026-10-26T13:30:00Z'),
  capacidad_disponible: 2,
  precio_por_pasajero: '18.50',
  driver_id: `driver-${id}`,
  nombre: `Conductor ${id}`,
  foto_url: null,
  route_pd: routePd,
});

describe('SearchRidesHandler', () => {
  const config = { get: (key: 'rides') => configuration()[key] } as unknown as ConfigService<never, true>;
  let match: jest.Mock;
  let findCandidates: jest.Mock;
  let handler: SearchRidesHandler;

  beforeEach(() => {
    match = jest.fn(async (req: MatchRequest) => ({ requestId: req.requestId, modelVersion: 'heuristic-v1', candidates: [] }));
    findCandidates = jest.fn(async () => []);
    handler = new SearchRidesHandler(
      { match } as unknown as MatchingClient,
      { findCandidates } as unknown as SearchRidesQueries,
      config,
    );
  });

  it('envía passengerId del token, requestId nuevo y defaults del DTO', async () => {
    const res = await handler.execute(PASSENGER, dto());

    const sent: MatchRequest = match.mock.calls[0][0];
    expect(sent.passengerId).toBe(PASSENGER);
    expect(sent.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent.requestId).toBe(res.requestId);
    expect(sent).toMatchObject({ timeWindowMin: 30, limit: 10, pickup: P, dropoff: D });
  });

  it('sin candidatos → results vacío y no consulta la BD', async () => {
    await expect(handler.execute(PASSENGER, dto())).resolves.toMatchObject({ results: [] });
    expect(findCandidates).not.toHaveBeenCalled();
  });

  it.each([
    ['pickup fuera del bbox', { pickup: { lat: 19.43, lng: -99.13 } }],
    ['dropoff fuera del bbox', { dropoff: { lat: 25.0, lng: -89.6 } }],
    ['departureAt pasado', { departureAt: new Date(Date.now() - 2 * 3_600_000).toISOString() }],
    ['departureAt a más de 14 días', { departureAt: new Date(Date.now() + 15 * 86_400_000).toISOString() }],
  ])('%s → 400 sin llamar a matching-py', async (_name, overrides) => {
    await expect(handler.execute(PASSENGER, dto(overrides as Partial<SearchRidesDto>))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(match).not.toHaveBeenCalled();
  });

  it('MatchingUnavailable → 503', async () => {
    match.mockRejectedValue(new MatchingUnavailable('caído'));
    await expect(handler.execute(PASSENGER, dto())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('MatchingContractError → 502', async () => {
    match.mockRejectedValue(new MatchingContractError('422', { detail: [] }));
    await expect(handler.execute(PASSENGER, dto())).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('respeta el orden de matching-py, descarta viajes no disponibles y renumera rank', async () => {
    match.mockImplementation(async (req: MatchRequest) => ({
      requestId: req.requestId,
      modelVersion: 'heuristic-v1',
      candidates: [candidate('a', 1), candidate('b', 2), candidate('c', 3)],
    }));
    const clipped = { type: 'LineString' as const, coordinates: [[-89.58, 21.01], [-89.62, 20.96]] as [number, number][] };
    // La BD no devuelve "b" (cancelado o lleno) y devuelve en otro orden.
    findCandidates.mockResolvedValue([row('c'), row('a', clipped)]);

    const { results } = await handler.execute(PASSENGER, dto());

    expect(results.map((r) => [r.rideId, r.rank])).toEqual([['a', 1], ['c', 2]]);
    expect(results[0]).toMatchObject({
      routeGeometry: clipped, // recortada por la BD, no la A→P→D→B de matching-py
      pricePerPassenger: 18.5,
      seatsAvailable: 2,
      departureAt: '2026-10-26T13:30:00.000Z',
      driver: { id: 'driver-a', nombre: 'Conductor a', fotoUrl: null },
    });
    expect(results[0]).not.toHaveProperty('score');
  });
});
