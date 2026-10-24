import { IsLatitude, IsLongitude, IsOptional, IsInt, Max, Min } from 'class-validator';

/**
 * Ubicación puntual del usuario. NUNCA se persiste en PostgreSQL:
 * se guarda solo en Redis con TTL y "se reinicia" sola al expirar.
 */
export class SetLocationDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  /** TTL opcional en segundos; si se omite, se usa location.ttlSeconds de la config. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 60 * 24)
  ttlSeconds?: number;
}
