import { ApiError, request } from '@/api/http';
import { Coords } from '@/data/rides';

// Ubicación en tiempo real. El backend la guarda SOLO en Redis con TTL
// (src/location), nunca en PostgreSQL; si el conductor deja de mandarla, expira sola.
type StoredLocation = { lat: number; lng: number; actualizadaEn: number };

// Segundos que vive cada lectura en el servidor si el teléfono deja de mandar
const LIVE_TTL_SECONDS = 120;

export async function shareLocation(userId: string, c: Coords, token?: string | null) {
  await request('/location/' + encodeURIComponent(userId), {
    method: 'PUT',
    token,
    body: { lat: c.latitude, lng: c.longitude, ttlSeconds: LIVE_TTL_SECONDS },
  });
}

export async function stopSharing(userId: string, token?: string | null) {
  await request('/location/' + encodeURIComponent(userId), { method: 'DELETE', token });
}

// null si el conductor no está compartiendo (404) o su lectura ya expiró
export async function getLocation(userId: string, token?: string | null): Promise<(Coords & { at: number }) | null> {
  try {
    const l = await request<StoredLocation>('/location/' + encodeURIComponent(userId), { token });
    return l ? { latitude: l.lat, longitude: l.lng, at: l.actualizadaEn } : null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
