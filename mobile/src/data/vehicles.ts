import { VehicleCategory } from '@/constants/pricing';

// Catálogo de la plataforma: el conductor elige su coche de aquí (no escribe el rendimiento)
export type CatalogCar = { id: string; name: string; category: VehicleCategory };

export const CAR_CATALOG: CatalogCar[] = [
  { id: 'mazda3', name: 'Mazda 3', category: 'Sedan' },
  { id: 'jetta', name: 'VW Jetta', category: 'Sedan' },
  { id: 'versa', name: 'Nissan Versa', category: 'Sedan' },
  { id: 'corolla', name: 'Toyota Corolla', category: 'Sedan' },
  { id: 'crv', name: 'Honda CR-V', category: 'SUV' },
  { id: 'kicks', name: 'Nissan Kicks', category: 'SUV' },
  { id: 'cx5', name: 'Mazda CX-5', category: 'SUV' },
  { id: 'hilux', name: 'Toyota Hilux', category: 'Camioneta' },
  { id: 'np300', name: 'Nissan NP300', category: 'Camioneta' },
  { id: 'ranger', name: 'Ford Ranger', category: 'Camioneta' },
];
