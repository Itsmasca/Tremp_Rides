import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

/** Sólo nombre y foto. Correo, sexo, tipo y verificado no se editan aquí (spec 005, AC4.2). */
export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  /** `null` quita la foto. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  fotoUrl?: string | null;
}
