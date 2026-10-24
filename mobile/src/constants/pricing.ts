// Modelo de precios (issue #4). Todo esto lo fija el servidor: la app solo lo muestra.
// Mientras no hay backend, usamos los valores iniciales del issue.

export type VehicleCategory = 'Sedan' | 'SUV' | 'Camioneta';

// Rendimiento fijo por categoría (km por litro). El conductor no lo puede editar.
export const EFFICIENCY_KM_L: Record<VehicleCategory, number> = {
  Sedan: 11,
  SUV: 9,
  Camioneta: 7,
};

export const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  Sedan: 'Sedán',
  SUV: 'SUV',
  Camioneta: 'Camioneta',
};

// Gasolina Premium (roja) en Yucatán. Lo actualiza el sistema desde una fuente oficial.
export const FUEL = {
  name: 'Premium',
  pricePerLiter: 27.39,
  updatedAt: 'hoy 6:00 AM',
};

// Reparto fijo: el pasajero paga el 70% de la gasolina, el conductor absorbe el 30%.
export const PASSENGER_SHARE = 0.7;

export type PriceBreakdown = {
  km: number;
  efficiency: number;
  liters: number;
  fuelCost: number;
  passengerPays: number;
  driverAbsorbs: number;
};

export function calculatePrice(rawKm: number, category: VehicleCategory): PriceBreakdown {
  const km = Math.round(rawKm * 10) / 10; // evita 7.300000000000001
  const efficiency = EFFICIENCY_KM_L[category];
  const liters = km / efficiency;
  const fuelCost = liters * FUEL.pricePerLiter;
  const passengerPays = fuelCost * PASSENGER_SHARE;
  return {
    km,
    efficiency,
    liters,
    fuelCost,
    passengerPays,
    driverAbsorbs: fuelCost - passengerPays,
  };
}

export const money = (n: number) => `$${n.toFixed(2)}`;
