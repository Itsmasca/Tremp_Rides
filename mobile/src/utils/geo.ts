import { Coords } from '@/data/rides';

// Distancia en línea recta (km). Solo para mostrar "a X km"; los km del precio
// los calcula el servidor de rutas.
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Velocidad promedio en ciudad para estimar minutos de llegada
const CITY_KMH = 25;

export const etaMinutes = (km: number) => Math.max(1, Math.round((km / CITY_KMH) * 60));

// Punto intermedio entre a y b (t de 0 a 1)
export const lerp = (a: Coords, b: Coords, t: number): Coords => ({
  latitude: a.latitude + (b.latitude - a.latitude) * t,
  longitude: a.longitude + (b.longitude - a.longitude) * t,
});

// Punto a una fracción t (0 a 1) del recorrido total de una ruta con varias paradas
export function alongRoute(points: Coords[], t: number): Coords {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  if (points.length === 1 || t <= 0) return points[0];
  const legs = points.slice(1).map((p, i) => distanceKm(points[i], p));
  const total = legs.reduce((a, b) => a + b, 0);
  if (total === 0 || t >= 1) return points[points.length - 1];
  let left = total * t;
  for (let i = 0; i < legs.length; i++) {
    if (left <= legs[i]) return lerp(points[i], points[i + 1], legs[i] === 0 ? 1 : left / legs[i]);
    left -= legs[i];
  }
  return points[points.length - 1];
}
