import { useEffect, useRef, useState } from 'react';

import { getLocation } from '@/api/location';
import { ANAHUAC, Coords } from '@/data/rides';
import { useUser } from '@/store/user';
import { lerp } from '@/utils/geo';

// Cada cuánto pregunta el pasajero por la posición del conductor
const POLL_MS = 3000;
// Demo: segundos que tarda el conductor simulado en llegar
const DEMO_SECONDS = 60;

type Args = {
  active: boolean; // true cuando el conductor ya aceptó
  driverId?: string; // id real del conductor en el backend
  start: Coords; // de dónde sale el conductor (para la demo)
  pickup: Coords | null; // dónde lo espera el pasajero
};

// Pasajero: posición en vivo del conductor.
// - Si el conductor es un usuario real, la lee del backend cada 3 s (GET /location/:id).
// - Si es un ride de prueba (sin id real), simula que se acerca al punto de recogida.
export function useDriverLocation({ active, driverId, start, pickup }: Args) {
  const { token } = useUser();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [live, setLive] = useState(false);
  const target = useRef<Coords>(ANAHUAC);

  // Siempre apuntamos a la posición más reciente del pasajero
  useEffect(() => {
    target.current = pickup ?? ANAHUAC;
  }, [pickup]);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    let timer: ReturnType<typeof setInterval>;

    if (driverId) {
      const tick = async () => {
        try {
          const l = await getLocation(driverId, token);
          if (stop) return;
          setLive(!!l);
          if (l) setCoords({ latitude: l.latitude, longitude: l.longitude });
        } catch {
          if (!stop) setLive(false);
        }
      };
      timer = setInterval(tick, POLL_MS);
      setTimeout(tick, 0);
    } else {
      // Demo sin backend: avanza un poco cada segundo hasta llegar
      const startedAt = Date.now();
      const tick = () => {
        if (stop) return;
        const t = Math.min(1, (Date.now() - startedAt) / (DEMO_SECONDS * 1000));
        setLive(true);
        setCoords(lerp(start, target.current, t));
        if (t >= 1) clearInterval(timer);
      };
      timer = setInterval(tick, 1000);
      setTimeout(tick, 0);
    }

    return () => {
      stop = true;
      clearInterval(timer);
      setCoords(null);
      setLive(false);
    };
  }, [active, driverId, token, start]);

  return { coords: active ? coords : null, live: active && live };
}
