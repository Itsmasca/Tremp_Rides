import { useSyncExternalStore } from 'react';

import { VehicleCategory } from '@/constants/pricing';
import { RideTime } from '@/data/rides';

// Estado global mínimo del usuario (sin librerías, ideal para hackathon)
export type Role = 'pasajero' | 'conductor';

export type User = {
  name: string;
  gender: 'hombre' | 'mujer' | null;
  womenOnly: boolean;
  hasVehicle: boolean;
  vehicleType: VehicleCategory | null;
  carName: string | null; // del catálogo de la plataforma
  role: Role;
  time: RideTime | null; // horario habitual para ir a la Anáhuac
};

let user: User = {
  name: 'Estudiante',
  gender: null,
  womenOnly: false,
  hasVehicle: false,
  vehicleType: null,
  carName: null,
  role: 'pasajero',
  time: null,
};

const listeners = new Set<() => void>();

export function setUser(partial: Partial<User>) {
  user = { ...user, ...partial };
  listeners.forEach((l) => l());
}

export function useUser() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => user,
    () => user,
  );
}
