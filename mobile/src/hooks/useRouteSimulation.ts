import { useEffect, useRef, useState } from 'react';

import { Coords } from '@/data/rides';
import { alongRoute } from '@/utils/geo';

// Demo: mueve un punto por una ruta (varias paradas) en `seconds` segundos.
// Sirve para enseñar la app sin estar manejando de verdad.
// `runKey` reinicia el recorrido desde el principio cuando cambia.
export function useRouteSimulation(active: boolean, waypoints: Coords[], seconds: number, runKey = '') {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [done, setDone] = useState(false);
  const route = useRef<Coords[]>(waypoints);

  // Siempre usamos las paradas más recientes (por ejemplo, si el GPS se actualiza)
  useEffect(() => {
    route.current = waypoints;
  }, [waypoints]);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setInterval>;
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / (seconds * 1000));
      setCoords(alongRoute(route.current, t));
      if (t >= 1) {
        setDone(true);
        clearInterval(timer);
      }
    };
    timer = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
      setCoords(null);
      setDone(false);
    };
  }, [active, seconds, runKey]);

  return { coords: active ? coords : null, done: active && done };
}
