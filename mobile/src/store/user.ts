import { useSyncExternalStore } from 'react';

// Estado global mínimo del usuario (sin librerías, ideal para hackathon)
export type Role = 'pasajero' | 'conductor';

export type User = {
  name: string;
  gender: 'hombre' | 'mujer' | null;
  womenOnly: boolean;
  hasVehicle: boolean;
  vehicleType: 'Sedan' | 'SUV' | 'Camioneta' | null;
  role: Role;
};

let user: User = {
  name: 'Estudiante',
  gender: null,
  womenOnly: false,
  hasVehicle: false,
  vehicleType: null,
  role: 'pasajero',
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
