import { request } from '@/api/http';
import { VehicleCategory } from '@/constants/pricing';
import { setUser, User } from '@/store/user';

// Tipos tal como los devuelve el backend (src/users/users.types.ts, camelCase)
export type ApiSexo = 'M' | 'F' | 'otro';
export type ApiCategoria = 'sedan' | 'suv' | 'camioneta';

export type ApiVehiculo = {
  categoria: ApiCategoria;
  marca: string | null;
  modelo: string | null;
  capacidad: number;
  rendimientoKmL: number;
};

export type ApiUser = {
  id: string;
  nombre: string;
  correo: string;
  sexo: ApiSexo;
  tipoUsuario: 'conductor' | 'pasajero';
  verificado: boolean;
  prefSexoViaje: 'cualquiera' | 'solo_M' | 'solo_F';
  fotoUrl: string | null;
  creadoEn: string;
  vehiculo: ApiVehiculo | null;
};

export type AuthResponse = { token: string; user: ApiUser };

export type RegisterInput = {
  nombre: string;
  correo: string;
  password: string;
  sexo: ApiSexo;
  prefSexoViaje?: 'cualquiera' | 'solo_F';
  vehiculo?: { categoria: ApiCategoria; capacidad: number };
};

const CATEGORY_TO_APP: Record<ApiCategoria, VehicleCategory> = {
  sedan: 'Sedan',
  suv: 'SUV',
  camioneta: 'Camioneta',
};

export const CATEGORY_TO_API: Record<VehicleCategory, ApiCategoria> = {
  Sedan: 'sedan',
  SUV: 'suv',
  Camioneta: 'camioneta',
};

// Convierte el usuario de la API al estado que usa la app
export function toAppUser(u: ApiUser, token: string): Partial<User> {
  const v = u.vehiculo;
  return {
    id: u.id,
    token,
    name: u.nombre,
    email: u.correo,
    gender: u.sexo === 'F' ? 'mujer' : u.sexo === 'M' ? 'hombre' : null,
    womenOnly: u.prefSexoViaje === 'solo_F',
    hasVehicle: !!v,
    vehicleType: v ? CATEGORY_TO_APP[v.categoria] : null,
    carName: v ? [v.marca, v.modelo].filter(Boolean).join(' ') || null : null,
    role: u.tipoUsuario,
  };
}

export async function login(correo: string, password: string) {
  const res = await request<AuthResponse>('/auth/login', { method: 'POST', body: { correo, password } });
  setUser(toAppUser(res.user, res.token));
  return res;
}

export async function register(input: RegisterInput) {
  const res = await request<AuthResponse>('/auth/register', { method: 'POST', body: input });
  setUser(toAppUser(res.user, res.token));
  return res;
}

// Restaura la sesión a partir del token (GET /auth/me)
export async function me(token: string) {
  const user = await request<ApiUser>('/auth/me', { token });
  setUser(toAppUser(user, token));
  return user;
}
