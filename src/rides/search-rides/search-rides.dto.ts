import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, Matches, Max, Min, ValidateNested } from 'class-validator';

export class LatLngDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}

/**
 * Body de `POST /rides/search`. El pasajero sale del token, nunca del body.
 * El bbox y el horizonte dependen de config: se validan en el handler.
 */
export class SearchRidesDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  pickup: LatLngDto;

  @ValidateNested()
  @Type(() => LatLngDto)
  dropoff: LatLngDto;

  /** ISO-8601 con zona horaria (matching-py la exige): `2026-10-26T07:30:00-06:00` o `…Z`. */
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, {
    message: 'departureAt debe ser ISO-8601 con zona horaria',
  })
  departureAt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  timeWindowMin: number = 30;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 10;
}
