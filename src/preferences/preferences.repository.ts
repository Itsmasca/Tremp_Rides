import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseError } from 'pg';
import { DatabaseService } from '../database/database.service';
import { PrefSexoViaje } from './dto/update-preferences.dto';

export interface UserPreferenceRow {
  id: string;
  pref_sexo_viaje: PrefSexoViaje;
  /** Número de veces que se han actualizado las preferencias — usado como revision. */
  preferences_revision: number;
  raw_text: string | null;
}

@Injectable()
export class PreferencesRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Lee las preferencias actuales del usuario.
   * Lanza NotFoundException si el usuario no existe.
   */
  async findByUserId(userId: string): Promise<UserPreferenceRow> {
    const row = await this.db.queryOne<UserPreferenceRow>(
      `SELECT id,
              pref_sexo_viaje,
              COALESCE(preferences_revision, 0) AS preferences_revision,
              raw_text
         FROM users
        WHERE id = $1`,
      [userId],
    );
    if (!row) throw new NotFoundException(`Usuario ${userId} no encontrado`);
    return row;
  }

  /**
   * Actualiza pref_sexo_viaje, raw_text y preferences_revision en una sola query.
   * Retorna la revisión resultante (para incluirla en el evento).
   *
   * El UPDATE es condicional: solo si el usuario existe.
   * raw_text y preferences_revision son columnas que se agregan en la migración
   * 002_add_preferences_columns.sql.
   */
  async updatePreferences(
    userId: string,
    prefSexoViaje: PrefSexoViaje,
    rawText: string,
  ): Promise<{ revision: number }> {
    const row = await this.db
      .queryOne<{ preferences_revision: number }>(
        `UPDATE users
            SET pref_sexo_viaje      = $1,
                raw_text             = $2,
                preferences_revision = COALESCE(preferences_revision, 0) + 1
          WHERE id = $3
         RETURNING preferences_revision`,
        [prefSexoViaje, rawText, userId],
      )
      .catch((err: unknown) => {
        // El CHECK de la BD es la última barrera (principio 10): se traduce a 400, no 500.
        if (err instanceof DatabaseError && err.constraint === 'chk_pref_solo_mujeres') {
          throw new BadRequestException("prefSexoViaje 'solo_F' sólo aplica cuando sexo = 'F'");
        }
        throw err;
      });
    if (!row) throw new NotFoundException(`Usuario ${userId} no encontrado`);
    return { revision: row.preferences_revision };
  }
}
