import { request } from '@/api/http';
import { Coords, Ride, RideTime } from '@/data/rides';
import { distanceKm } from '@/utils/geo';

// POST /rides/search (spec 010): el backend reenvía la búsqueda a matching-py y completa con datos del viaje.
type LatLng = { lat: number; lng: number };

type SearchResult = {
  rideId: string;
  rank: number;
  departureAt: string;
  seatsAvailable: number;
  pricePerPassenger: number | null;
  detourS: number;
  pickupEtaS: number;
  driver: { id: string; nombre: string; sexo?: 'M' | 'F' | 'otro'; fotoUrl: string | null };
  snappedPickup: LatLng;
  snappedDropoff: LatLng;
  // Sólo el tramo recogida → bajada: el origen del conductor nunca llega a la app
  routeGeometry: { type: 'LineString'; coordinates: [number, number][] } | null;
};

type SearchResponse = { requestId: string; results: SearchResult[] };

// Mérida está en UTC-6 todo el año (sin horario de verano)
const MERIDA_OFFSET = '-06:00';

// "7:00 AM" → próxima salida a esa hora en Mérida, ISO con zona (matching-py la exige)
export function departureFor(time: RideTime, now = new Date()): string {
  const [, hh, mm, ampm] = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time)!;
  const hour = (Number(hh) % 12) + (ampm === 'PM' ? 12 : 0);
  // "Hoy" en Mérida y, si esa hora ya pasó, mañana
  const merida = new Date(now.getTime() - 6 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const at = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(hour)}:${mm}:00${MERIDA_OFFSET}`;
  const today = at(merida);
  return Date.parse(today) > now.getTime() ? today : at(new Date(merida.getTime() + 86_400_000));
}

// "13:30Z" → "7:30 AM" en Mérida, mismo formato que TIMES
export function formatTime(iso: string): string {
  const d = new Date(Date.parse(iso) - 6 * 3600_000);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const toCoords = (p: LatLng): Coords => ({ latitude: p.lat, longitude: p.lng });

function routeKm(route: SearchResult['routeGeometry']): number {
  if (!route) return 0;
  let km = 0;
  for (let i = 1; i < route.coordinates.length; i++) {
    const [aLng, aLat] = route.coordinates[i - 1];
    const [bLng, bLat] = route.coordinates[i];
    km += distanceKm({ latitude: aLat, longitude: aLng }, { latitude: bLat, longitude: bLng });
  }
  return km;
}

// Resultado del backend → Ride de la app. Lo que el backend aún no tiene (calificación, auto) queda vacío.
export function toRide(r: SearchResult): Ride {
  const detourMin = Math.max(0, Math.round(r.detourS / 60));
  return {
    id: r.rideId,
    driverId: r.driver.id,
    driver: r.driver.nombre,
    driverGender: r.driver.sexo === 'F' ? 'mujer' : r.driver.sexo === 'M' ? 'hombre' : null,
    origin: detourMin ? `Se desvía ${detourMin} min por ti` : 'Pasa por tu ruta',
    // Pin en el punto de recogida: la ubicación del conductor no se expone
    coords: toCoords(r.snappedPickup),
    departure: formatTime(r.departureAt),
    etaMin: Math.round(r.pickupEtaS / 60),
    seats: r.seatsAvailable,
    vehicle: 'Sedan',
    car: 'Auto del conductor',
    pickupKm: 0,
    tripKm: routeKm(r.routeGeometry),
    price: r.pricePerPassenger ?? undefined,
    live: true,
  };
}

export async function searchRides(params: {
  pickup: Coords;
  dropoff: Coords;
  time: RideTime;
  token: string;
}): Promise<Ride[]> {
  const res = await request<SearchResponse>('/rides/search', {
    method: 'POST',
    token: params.token,
    body: {
      pickup: { lat: params.pickup.latitude, lng: params.pickup.longitude },
      dropoff: { lat: params.dropoff.latitude, lng: params.dropoff.longitude },
      departureAt: departureFor(params.time),
    },
  });
  return res.results.map(toRide);
}
