/** Cálculo del cobro (issue #4 + comisión, spec 011). Montos en MXN con 2 decimales. */
export interface Fare {
  km: number;
  rendimientoKmL: number;
  precioLitro: number;
  gasolina: number;
  pasajero: number;
  comision: number;
  total: number;
  conductor: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateFare(
  km: number,
  rendimientoKmL: number,
  precioLitro: number,
  repartoPasajero: number,
  comision: number,
): Fare {
  const gasolina = round2((km / rendimientoKmL) * precioLitro);
  const pasajero = round2(gasolina * repartoPasajero);
  return {
    km,
    rendimientoKmL,
    precioLitro,
    gasolina,
    pasajero,
    comision,
    total: round2(pasajero + comision),
    conductor: pasajero,
  };
}
