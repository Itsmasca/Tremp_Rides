import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TipoUsuario } from '../users.types';

export class ListUsersQuery {
  @IsOptional()
  @IsIn(['conductor', 'pasajero'])
  tipo?: TipoUsuario;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  verificado?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** Cursor opaco devuelto como `nextCursor` en la página anterior. */
  @IsOptional()
  @IsString()
  after?: string;
}
