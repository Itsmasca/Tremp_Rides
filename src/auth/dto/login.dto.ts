import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { CORREO_ANAHUAC } from '../../users/dto/create-user.dto';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(CORREO_ANAHUAC, { message: 'correo debe ser institucional @anahuac.mx' })
  correo: string;

  @IsString()
  @Length(1, 128)
  password: string;
}
