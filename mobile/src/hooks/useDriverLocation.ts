import { useEffect, useMemo, useState } from 'react';

import { getLocation } from '@/api/location';
import { Coords } from '@/data/rides';
import { useRouteSimulation } from '@/hooks/useRouteSimulation';
import { useUser } from '@/store/user';

// Cada cuánto pregunta el pasajero por la posición del conductor
const POLL_MS = 3000;

type Args = {
  active: boolean; // true mientras hay que seguir al conductor
  driverId?: string; // id real del conductor en el backend
  start: Coords; // de dónde sale el conductor (solo para la demo)
  target: Coords; // hacia dónde va (recogida o la Anáhuac; solo para la demo)
  demoSeconds: number; // cuánto tarda el recorrido simulado
  stage: string; // cambia de etapa (ir por el pasajero / ir a la Anáhuac) y reinicia la demo
};

// Pasajero: posición en vivo del conductor.
// - Si el conductor es un usuario real, la lee del backend cada 3 s (GET /location/:id).
// - Si es un ride de prueba (sin id real), simula el recorrido de `start` a `target`.
export function useDriverLocation({ active, driverId, start, target, demoSeconds, stage }: Args) {
  const { token } = useUser();
  const [real, setReal] = useState<Coords | null>(null);
  const [live, setLive] = useState(false);

  const route = useMemo(() => [start, target], [start, target]);
  const demo = useRouteSimulation(active && !driverId, route, demoSeconds, stage);

  useEffect(() => {
    if (!active || !driverId) return;
    let stop = false;
    const tick = async () => {
      try {
        const l = await getLocation(driverId, token);
        if (stop) return;
        setLive(!!l);
        if (l) setReal({ latitude: l.latitude, longitude: l.longitude });
      } catch {
        if (!stop) setLive(false);
      }
    };
    const timer = setInterval(tick, POLL_MS);
    const first = setTimeout(tick, 0);
    return () => {
      stop = true;
      clearInterval(timer);
      clearTimeout(first);
      setReal(null);
      setLive(false);
    };
  }, [active, driverId, token]);

  if (!active) return { coords: null, live: false };
  if (driverId) return { coords: real, live };
  return { coords: demo.coords, live: !!demo.coords };
}
