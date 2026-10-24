import { useEffect, useRef } from 'react';

import { shareLocation, stopSharing } from '@/api/location';
import { Coords } from '@/data/rides';
import { useUser } from '@/store/user';

// Mínimo de segundos entre envíos para no saturar el servidor
const MIN_INTERVAL_MS = 4000;

// Conductor: mientras `active` sea true, manda su posición al backend para que
// sus pasajeros lo vean acercarse. Al apagarse, borra la ubicación del servidor.
export function useShareLocation(active: boolean, coords: Coords | null) {
  const { id, token } = useUser();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active || !id || !coords) return;
    const now = Date.now();
    if (now - lastSent.current < MIN_INTERVAL_MS) return;
    lastSent.current = now;
    shareLocation(id, coords, token).catch((e) => console.warn('[ubicación]', e?.message));
  }, [active, id, token, coords]);

  useEffect(() => {
    if (!active || !id) return;
    return () => {
      lastSent.current = 0;
      stopSharing(id, token).catch(() => {});
    };
  }, [active, id, token]);
}
