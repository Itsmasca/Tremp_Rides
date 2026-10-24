export type Sexo = 'M' | 'F' | 'otro';
export type TipoUsuario = 'conductor' | 'pasajero';
export type PrefSexoViaje = 'cualquiera' | 'solo_M' | 'solo_F';
export type CategoriaVehiculo = 'sedan' | 'suv' | 'camioneta';

export const SEXOS: Sexo[] = ['M', 'F', 'otro'];
export const PREFS_SEXO_VIAJE: PrefSexoViaje[] = ['cualquiera', 'solo_M', 'solo_F'];
export const CATEGORIAS_VEHICULO: CategoriaVehiculo[] = ['sedan', 'suv', 'camioneta'];

export interface Vehiculo {
  categoria: CategoriaVehiculo;
  marca: string | null;
  modelo: string | null;
  capacidad: number;
  /** Viene del catálogo (issue #4), nunca del conductor. */
  rendimientoKmL: number;
}

/** Usuario tal como sale de la API: nunca incluye password_hash. */
export interface User {
  id: string;
  nombre: string;
  correo: string;
  sexo: Sexo;
  tipoUsuario: TipoUsuario;
  verificado: boolean;
  prefSexoViaje: PrefSexoViaje;
  fotoUrl: string | null;
  creadoEn: string;
  vehiculo: Vehiculo | null;
}
