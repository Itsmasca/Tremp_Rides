import { VehicleCategory } from '@/constants/pricing';

// Datos de prueba mientras no hay backend.
// Los km los calcula el navegador en el servidor; aquí vienen ya calculados.
export type Coords = { latitude: number; longitude: number };

// Horarios de salida a la Anáhuac que pueden elegir conductor y pasajero
export const TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM'] as const;
export type RideTime = (typeof TIMES)[number];

export type Ride = {
  id: string;
  driver: string;
  driverGender: 'hombre' | 'mujer';
  rating: number;
  origin: string;
  coords: Coords;
  departure: RideTime;
  etaMin: number;
  seats: number;
  vehicle: VehicleCategory;
  car: string;
  // Tramo conductor → recogida + recogida → Anáhuac (calculado en el servidor)
  pickupKm: number;
  tripKm: number;
};

export type PassengerRequest = {
  id: string;
  name: string;
  rating: number;
  pickup: string;
  coords: Coords;
  time: RideTime; // hora a la que quiere salir
  pickupKm: number; // del conductor al punto de recogida
  tripKm: number; // de la recogida a la Anáhuac
};

export const ANAHUAC: Coords = { latitude: 21.0436, longitude: -89.6295 };

export const MERIDA_REGION = {
  latitude: 21.005,
  longitude: -89.63,
  latitudeDelta: 0.14,
  longitudeDelta: 0.14,
};

export const RIDES: Ride[] = [
  { id: '1', driver: 'Sofía Pérez', driverGender: 'mujer', rating: 4.9, origin: 'Altabrisa', coords: { latitude: 21.021, longitude: -89.585 }, departure: '7:00 AM', etaMin: 18, seats: 3, vehicle: 'Sedan', car: 'Mazda 3 blanco', pickupKm: 2, tripKm: 7 },
  { id: '2', driver: 'Carlos Medina', driverGender: 'hombre', rating: 4.7, origin: 'Francisco de Montejo', coords: { latitude: 21.03, longitude: -89.655 }, departure: '7:30 AM', etaMin: 12, seats: 2, vehicle: 'SUV', car: 'Honda CR-V gris', pickupKm: 3, tripKm: 6 },
  { id: '3', driver: 'Mariana Canul', driverGender: 'mujer', rating: 5.0, origin: 'Centro Histórico', coords: { latitude: 20.9674, longitude: -89.6237 }, departure: '6:30 AM', etaMin: 25, seats: 4, vehicle: 'Camioneta', car: 'Toyota Hilux roja', pickupKm: 4, tripKm: 11 },
  { id: '4', driver: 'Diego Ruiz', driverGender: 'hombre', rating: 4.8, origin: 'Caucel', coords: { latitude: 21.005, longitude: -89.71 }, departure: '8:00 AM', etaMin: 28, seats: 1, vehicle: 'Sedan', car: 'VW Jetta azul', pickupKm: 5, tripKm: 12 },
];

export const REQUESTS: PassengerRequest[] = [
  { id: 'r1', name: 'Ana López', rating: 4.9, pickup: 'Plaza Altabrisa', coords: { latitude: 21.024, longitude: -89.59 }, time: '7:00 AM', pickupKm: 1.2, tripKm: 6.5 },
  { id: 'r2', name: 'Luis Chan', rating: 4.6, pickup: 'Hospital Star Médica', coords: { latitude: 21.018, longitude: -89.6 }, time: '7:00 AM', pickupKm: 2.4, tripKm: 5.8 },
  { id: 'r3', name: 'Valeria Ek', rating: 5.0, pickup: 'La Isla Mérida', coords: { latitude: 21.04, longitude: -89.605 }, time: '7:30 AM', pickupKm: 3.1, tripKm: 4.2 },
];
