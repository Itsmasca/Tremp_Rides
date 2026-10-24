import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { ANAHUAC, Coords } from '@/data/rides';
import { distanceKm } from '@/utils/geo';

// Zona de servicio: Mérida y alrededores. Fuera de este radio no usamos el GPS sino la Anáhuac
// (por ejemplo, el emulador de Android trae por defecto Mountain View, California), para que la demo
// funcione en cualquier emulador o navegador sin configurar la ubicación.
export const SERVICE_RADIUS_KM = 35;

type State = {
  coords: Coords | null; // null si no hay permiso; la Anáhuac si el GPS está fuera de Mérida
  granted: boolean | null; // null = todavía no se pidió
  outOfArea: boolean; // true si el GPS reporta una posición fuera de la zona de servicio
};

type Raw = { coords: Coords | null; granted: boolean | null };

// Pide permiso de ubicación y sigue la posición del usuario mientras la pantalla está montada.
// Solo vive en memoria. El conductor la comparte en vivo con useShareLocation
// (el backend la guarda solo en Redis con TTL, nunca en PostgreSQL).
export function useUserLocation(): State {
  const [state, setState] = useState<Raw>({ coords: null, granted: null });

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

  const outOfArea = !!state.coords && distanceKm(state.coords, ANAHUAC) > SERVICE_RADIUS_KM;
  return { coords: outOfArea ? ANAHUAC : state.coords, granted: state.granted, outOfArea };
}
