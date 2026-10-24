import { Type } from 'class-transformer';
import { IsIn, IsNumber, Max, Min } from 'class-validator';
import { CATEGORIAS_VEHICULO, CategoriaVehiculo } from '../../users/users.types';

/** Query de GET /payments/quote (spec 011, AC0.1). */
export class QuoteQueryDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(500)
  km: number;

  @IsIn(CATEGORIAS_VEHICULO)
  categoria: CategoriaVehiculo;
}
