import { IsDefined, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PublishEventDto {
  @IsString()
  @Matches(/^[a-z0-9]+([._-][a-z0-9]+)*$/i, { message: 'type debe tener formato dominio.accion (ej. order.created)' })
  @MaxLength(100)
  type: string;

  @IsDefined()
  payload: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  correlationId?: string;
}
