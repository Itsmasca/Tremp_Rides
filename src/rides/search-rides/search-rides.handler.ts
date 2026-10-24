import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../config/configuration';
import { MatchingClient } from '../../matching/matching.client';
import { MatchingContractError, MatchingUnavailable } from '../../matching/matching.errors';
import { GeoJsonLineString, LatLng, MatchResponse } from '../../matching/matching.types';
import { SearchRidesDto } from './search-rides.dto';
import { SearchRidesQueries } from './search-rides.queries';

/** Margen para búsquedas "ahora mismo" con el reloj del teléfono un poco atrasado. */
const MAX_PAST_MS = 60 * 60 * 1000;

export type SearchRideResult = {
  rideId: string;
  rank: number;
  departureAt: string;
  seatsAvailable: number;
  pricePerPassenger: number | null;
  detourS: number;
  pickupEtaS: number;
  driver: { id: string; nombre: string; fotoUrl: string | null };
  snappedPickup: LatLng;
  snappedDropoff: LatLng;
  routeGeometry: GeoJsonLineString | null;
};

export type SearchRidesResponse = { requestId: string; results: SearchRideResult[] };

/** `POST /rides/search`: valida → matching-py → completa con trips/users → respuesta (spec 010). */
@Injectable()
export class SearchRidesHandler {
  private readonly logger = new Logger(SearchRidesHandler.name);
  private readonly rides: AppConfig['rides'];

  constructor(
    private readonly matching: MatchingClient,
    private readonly queries: SearchRidesQueries,
    config: ConfigService<AppConfig, true>,
  ) {
    this.rides = config.get('rides', { infer: true });
  }

  async execute(passengerId: string, dto: SearchRidesDto): Promise<SearchRidesResponse> {
    this.validate(dto);

    const requestId = randomUUID();
    const started = performance.now();
    let match: MatchResponse;
    try {
      match = await this.matching.match({
        requestId,
        passengerId,
        pickup: dto.pickup,
        dropoff: dto.dropoff,
        departureAt: dto.departureAt,
        timeWindowMin: dto.timeWindowMin,
        limit: dto.limit,
      });
    } catch (err) {
      if (err instanceof MatchingUnavailable) {
        this.logger.warn(`search_unavailable | requestId=${requestId} ${err.message}`);
        throw new ServiceUnavailableException('La búsqueda no está disponible');
      }
      if (err instanceof MatchingContractError) {
        // crud-ts ya validó la entrada: un 4xx de matching-py es una diferencia de contrato (AC2.3).
        this.logger.error(`search_contract | requestId=${requestId} ${err.message} body=${JSON.stringify(err.body)}`);
        throw new BadGatewayException('Respuesta inválida del servicio de búsqueda');
      }
      throw err;
    }
    const matchMs = Math.round(performance.now() - started);

    const results = match.candidates.length ? await this.enrich(requestId, match) : [];

    this.logger.log(
      `search | requestId=${requestId} passengerId=${passengerId} model=${match.modelVersion} ` +
        `candidates=${match.candidates.length} returned=${results.length} matchMs=${matchMs}`,
    );
    return { requestId, results };
  }

  private validate(dto: SearchRidesDto): void {
    for (const field of ['pickup', 'dropoff'] as const) {
      if (!this.inBbox(dto[field])) {
        throw new BadRequestException(`${field} está fuera del área de servicio (península de Yucatán)`);
      }
    }

    const departure = Date.parse(dto.departureAt);
    const now = Date.now();
    if (Number.isNaN(departure)) throw new BadRequestException('departureAt no es una fecha válida');
    if (departure < now - MAX_PAST_MS) throw new BadRequestException('departureAt ya pasó');
    if (departure > now + this.rides.maxDaysAhead * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`departureAt no puede ser a más de ${this.rides.maxDaysAhead} días`);
    }
  }

  private inBbox({ lat, lng }: LatLng): boolean {
    const b = this.rides.peninsulaBbox;
    return lng >= b.minLng && lng <= b.maxLng && lat >= b.minLat && lat <= b.maxLat;
  }

  /** Mantiene el orden de matching-py, descarta viajes que ya no están disponibles y renumera `rank`. */
  private async enrich(requestId: string, match: MatchResponse): Promise<SearchRideResult[]> {
    const rows = new Map((await this.queries.findCandidates(match.candidates)).map((r) => [r.id, r]));
    const results: SearchRideResult[] = [];

    for (const c of match.candidates) {
      const row = rows.get(c.rideId);
      if (!row) continue;
      if (c.routeGeometry && !row.route_pd) {
        this.logger.warn(`search_route_cut | requestId=${requestId} rideId=${c.rideId} recogida después de la bajada`);
      }
      results.push({
        rideId: c.rideId,
        rank: results.length + 1,
        departureAt: row.salida_en.toISOString(),
        seatsAvailable: row.capacidad_disponible,
        pricePerPassenger: row.precio_por_pasajero === null ? null : Number(row.precio_por_pasajero),
        detourS: c.detourS,
        pickupEtaS: c.pickupEtaS,
        driver: { id: row.driver_id, nombre: row.nombre, fotoUrl: row.foto_url },
        snappedPickup: c.snappedPickup,
        snappedDropoff: c.snappedDropoff,
        routeGeometry: row.route_pd,
      });
    }
    return results;
  }
}
