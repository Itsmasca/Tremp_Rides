import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GeoJsonLineString, MatchCandidate } from '../../matching/matching.types';

export type SearchRideRow = {
  id: string;
  salida_en: Date;
  capacidad_disponible: number;
  precio_por_pasajero: string | null; // NUMERIC llega como string
  driver_id: string;
  nombre: string;
  foto_url: string | null;
  route_pd: GeoJsonLineString | null;
};

/**
 * Datos de viaje y conductor de los candidatos, y ruta recortada al tramo recogida → bajada
 * (el origen/destino del conductor no llegan al pasajero, AC3.3). Una sola consulta (principio 3).
 * Sólo devuelve viajes que siguen `pendiente` y con asientos (AC3.2); el orden lo pone el handler.
 */
const SQL = `
WITH c AS (
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS c(ride_id uuid, p_lng float8, p_lat float8, d_lng float8, d_lat float8, geom jsonb)
), g AS (
  SELECT c.ride_id,
         line,
         ST_LineLocatePoint(line, ST_SetSRID(ST_MakePoint(c.p_lng, c.p_lat), 4326)) AS p_frac,
         ST_LineLocatePoint(line, ST_SetSRID(ST_MakePoint(c.d_lng, c.d_lat), 4326)) AS d_frac
    FROM c
    CROSS JOIN LATERAL (SELECT ST_SetSRID(ST_GeomFromGeoJSON(c.geom::text), 4326) AS line) l
   WHERE c.geom IS NOT NULL
)
SELECT t.id, t.salida_en, t.capacidad_disponible, t.precio_por_pasajero,
       u.id AS driver_id, u.nombre, u.foto_url,
       CASE WHEN g.p_frac < g.d_frac
            THEN ST_AsGeoJSON(ST_LineSubstring(g.line, g.p_frac, g.d_frac))::json
       END AS route_pd
  FROM c
  JOIN trips t ON t.id = c.ride_id
  JOIN users u ON u.id = t.conductor_id
  LEFT JOIN g ON g.ride_id = c.ride_id
 WHERE t.estado = 'pendiente' AND t.capacidad_disponible > 0`;

@Injectable()
export class SearchRidesQueries {
  constructor(private readonly db: DatabaseService) {}

  findCandidates(candidates: MatchCandidate[]): Promise<SearchRideRow[]> {
    const input = candidates.map((c) => ({
      ride_id: c.rideId,
      p_lng: c.snappedPickup.lng,
      p_lat: c.snappedPickup.lat,
      d_lng: c.snappedDropoff.lng,
      d_lat: c.snappedDropoff.lat,
      geom: c.routeGeometry,
    }));
    return this.db.query<SearchRideRow>(SQL, [JSON.stringify(input)]);
  }
}
