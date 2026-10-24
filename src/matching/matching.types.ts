/**
 * Contrato de `POST /match` de matching-py (specs/001-osrm-matching/contracts/match-api.openapi.yaml
 * en awsLionRidealghoritm). No se cambia sin coordinarlo con matching-py.
 */

export type LatLng = { lat: number; lng: number };

export type GeoJsonLineString = { type: 'LineString'; coordinates: [number, number][] };

export type MatchRequest = {
  requestId: string;
  passengerId: string;
  pickup: LatLng;
  dropoff: LatLng;
  /** ISO-8601 con zona horaria. */
  departureAt: string;
  timeWindowMin: number;
  limit: number;
};

export type MatchCandidate = {
  rideId: string;
  rank: number;
  score: number;
  /** Segundos extra para el conductor; puede ser < 0 por diferencias de grafo. */
  detourS: number;
  pickupEtaS: number;
  snappedPickup: LatLng;
  snappedDropoff: LatLng;
  /** A→P→D→B; sólo en el top `ROUTE_GEOMETRY_TOP_K`, `null` en el resto. */
  routeGeometry: GeoJsonLineString | null;
};

export type MatchResponse = {
  requestId: string;
  modelVersion: string;
  candidates: MatchCandidate[];
};
