import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/** Valores del enum pref_sexo_viaje existente en la tabla users. */
export enum PrefSexoViaje {
  Cualquiera = 'cualquiera',
  SoloM = 'solo_M',
  SoloF = 'solo_F',
}

/**
 * Body de PATCH /users/:id/preferences
 *
 * raw_text: texto libre del usuario describiendo sus preferencias de viaje.
 * pref_sexo_viaje: la preferencia estructurada existente en users (columna SQL).
 *
 * matching-py recibirá raw_text y extraerá toda la estructura con Bedrock.
 * pref_sexo_viaje se persiste directamente en users para consultas SQL rápidas.
 */
export class UpdatePreferencesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rawText: string;

  @IsEnum(PrefSexoViaje)
  prefSexoViaje: PrefSexoViaje;
}
