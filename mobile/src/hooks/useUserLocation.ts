import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { Coords } from '@/data/rides';

type State = {
  coords: Coords | null;
  granted: boolean | null; // null = todavía no se pidió
};

// Pide permiso de ubicación y sigue la posición del usuario mientras la pantalla está montada.
// Solo vive en memoria. El conductor la comparte en vivo con useShareLocation
// (el backend la guarda solo en Redis con TTL, nunca en PostgreSQL).
export function useUserLocation(): State {
  const [state, setState] = useState<State>({ coords: null, granted: null });

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setState({ coords: null, granted: false });
        return;
      }

      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelled) {
        setState({ coords: { latitude: last.coords.latitude, longitude: last.coords.longitude }, granted: true });
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
        (pos) => {
          if (!cancelled) {
            setState({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, granted: true });
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return state;
}
