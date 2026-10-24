import { useSyncExternalStore } from 'react';

import { VehicleCategory } from '@/constants/pricing';
import { RideTime } from '@/data/rides';

// Estado global mínimo del usuario (sin librerías, ideal para hackathon)
export type Role = 'pasajero' | 'conductor';

export type User = {
  id: string | null; // id en el backend; null si no hay sesión
  token: string | null; // JWT para las peticiones protegidas
  name: string;
  email: string;
  gender: 'hombre' | 'mujer' | null;
  womenOnly: boolean;
  hasVehicle: boolean;
  vehicleType: VehicleCategory | null;
  carName: string | null; // del catálogo de la plataforma
  role: Role;
  time: RideTime | null; // horario habitual para ir a la Anáhuac
};

const EMPTY_USER: User = {
  id: null,
  token: null,
  name: 'Estudiante',
  email: '',
  gender: null,
  womenOnly: false,
  hasVehicle: false,
  vehicleType: null,
  carName: null,
  role: 'pasajero',
  time: null,
};

let user: User = EMPTY_USER;

const listeners = new Set<() => void>();

export function setUser(partial: Partial<User>) {
  user = { ...user, ...partial };
  listeners.forEach((l) => l());
}

// Cierra sesión: vuelve al estado inicial
export function clearUser() {
  user = EMPTY_USER;
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
