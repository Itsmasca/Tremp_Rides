// Datos de prueba mientras no hay backend
export type Coords = { latitude: number; longitude: number };

export type Ride = {
  id: string;
  driver: string;
  driverGender: 'hombre' | 'mujer';
  rating: number;
  origin: string;
  coords: Coords;
  departure: string;
  etaMin: number;
  price: number;
  seats: number;
  vehicle: 'Sedan' | 'SUV' | 'Camioneta';
  car: string;
};

export type PassengerRequest = {
  id: string;
  name: string;
  rating: number;
  pickup: string;
  coords: Coords;
  distanceKm: number;
};

export const ANAHUAC: Coords = { latitude: 21.0436, longitude: -89.6295 };

export const MERIDA_REGION = {
  latitude: 21.005,
  longitude: -89.63,
  latitudeDelta: 0.14,
  longitudeDelta: 0.14,
};

export const RIDES: Ride[] = [
  { id: '1', driver: 'Sofía Pérez', driverGender: 'mujer', rating: 4.9, origin: 'Altabrisa', coords: { latitude: 21.021, longitude: -89.585 }, departure: '7:10 AM', etaMin: 18, price: 25, seats: 3, vehicle: 'Sedan', car: 'Mazda 3 blanco' },
  { id: '2', driver: 'Carlos Medina', driverGender: 'hombre', rating: 4.7, origin: 'Francisco de Montejo', coords: { latitude: 21.03, longitude: -89.655 }, departure: '7:20 AM', etaMin: 12, price: 30, seats: 2, vehicle: 'SUV', car: 'Honda CR-V gris' },
  { id: '3', driver: 'Mariana Canul', driverGender: 'mujer', rating: 5.0, origin: 'Centro Histórico', coords: { latitude: 20.9674, longitude: -89.6237 }, departure: '6:50 AM', etaMin: 25, price: 35, seats: 4, vehicle: 'Camioneta', car: 'Toyota Hilux roja' },
  { id: '4', driver: 'Diego Ruiz', driverGender: 'hombre', rating: 4.8, origin: 'Caucel', coords: { latitude: 21.005, longitude: -89.71 }, departure: '6:40 AM', etaMin: 28, price: 40, seats: 1, vehicle: 'Sedan', car: 'VW Jetta azul' },
];

export const REQUESTS: PassengerRequest[] = [
  { id: 'r1', name: 'Ana López', rating: 4.9, pickup: 'Plaza Altabrisa', coords: { latitude: 21.024, longitude: -89.59 }, distanceKm: 1.2 },
  { id: 'r2', name: 'Luis Chan', rating: 4.6, pickup: 'Hospital Star Médica', coords: { latitude: 21.018, longitude: -89.6 }, distanceKm: 2.4 },
  { id: 'r3', name: 'Valeria Ek', rating: 5.0, pickup: 'La Isla Mérida', coords: { latitude: 21.04, longitude: -89.605 }, distanceKm: 3.1 },
];
