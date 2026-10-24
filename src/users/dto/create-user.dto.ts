import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CATEGORIAS_VEHICULO,
  CategoriaVehiculo,
  PREFS_SEXO_VIAJE,
  PrefSexoViaje,
  SEXOS,
  Sexo,
} from '../users.types';

/** Mismo dominio que el CHECK `chk_correo_anahuac` de la tabla users. */
export const CORREO_ANAHUAC = /^[A-Za-z0-9._%+-]+@anahuac\.mx$/i;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** El rendimiento NO se acepta: sale del catálogo según `categoria` (issue #4). */
export class VehicleDto {
  @IsIn(CATEGORIAS_VEHICULO)
  categoria: CategoriaVehiculo;

  @IsInt()
  @Min(1)
  @Max(8)
  capacidad: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  marca?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  modelo?: string;
}

export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(254)
  @Matches(CORREO_ANAHUAC, { message: 'correo debe ser institucional @anahuac.mx' })
  correo: string;

  @IsString()
  @Length(8, 128)
  password: string;

  @IsIn(SEXOS)
  sexo: Sexo;

  @IsOptional()
  @IsIn(PREFS_SEXO_VIAJE)
  prefSexoViaje?: PrefSexoViaje;

  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleDto)
  vehiculo?: VehicleDto;
}
