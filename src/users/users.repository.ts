import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { VehicleDto } from './dto/create-user.dto';
import { CategoriaVehiculo, PrefSexoViaje, Sexo, TipoUsuario, User } from './users.types';

interface UserRow {
  id: string;
  nombre: string;
  correo: string;
  sexo: Sexo;
  tipo_usuario: TipoUsuario;
  verificado: boolean;
  pref_sexo_viaje: PrefSexoViaje;
  foto_url: string | null;
  creado_en: Date;
  /** creado_en con precisión de microsegundos, para el cursor. */
  cursor_ts: string;
  categoria: CategoriaVehiculo | null;
  marca: string | null;
  modelo: string | null;
  capacidad: number | null;
  rendimiento_km_l: string | null;
}

export interface NewUser {
  nombre: string;
  correo: string;
  passwordHash: string;
  sexo: Sexo;
  tipoUsuario: TipoUsuario;
  prefSexoViaje: PrefSexoViaje;
}

export interface ListFilter {
  tipo?: TipoUsuario;
  verificado?: boolean;
  limit: number;
  after?: { ts: string; id: string };
}

type Executor = Pick<PoolClient, 'query'>;

const SELECT_USER = `
  SELECT u.id, u.nombre, u.correo, u.sexo, u.tipo_usuario, u.verificado, u.pref_sexo_viaje,
         u.foto_url, u.creado_en, u.creado_en::text AS cursor_ts,
         v.categoria, v.marca, v.modelo, v.capacidad, c.rendimiento_km_l
    FROM users u
    LEFT JOIN vehicles v         ON v.user_id = u.id
    LEFT JOIN vehicle_catalogo c ON c.categoria = v.categoria`;

const toUser = (row: UserRow): User => ({
  id: row.id,
  nombre: row.nombre,
  correo: row.correo,
  sexo: row.sexo,
  tipoUsuario: row.tipo_usuario,
  verificado: row.verificado,
  prefSexoViaje: row.pref_sexo_viaje,
  fotoUrl: row.foto_url,
  creadoEn: row.creado_en.toISOString(),
  vehiculo: row.categoria
    ? {
        categoria: row.categoria,
        marca: row.marca,
        modelo: row.modelo,
        capacidad: row.capacidad!,
        rendimientoKmL: Number(row.rendimiento_km_l),
      }
    : null,
});

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  transaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async insert(tx: Executor, user: NewUser): Promise<string> {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO users (nombre, correo, password_hash, sexo, tipo_usuario, pref_sexo_viaje)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user.nombre, user.correo, user.passwordHash, user.sexo, user.tipoUsuario, user.prefSexoViaje],
    );
    return rows[0].id;
  }

  /** Crea o reemplaza el vehículo (1 por usuario) y marca al usuario como conductor. */
  async upsertVehicle(tx: Executor, userId: string, vehicle: VehicleDto): Promise<boolean> {
    const { rowCount } = await tx.query(
      `UPDATE users SET tipo_usuario = 'conductor' WHERE id = $1`,
      [userId],
    );
    if (!rowCount) return false;
    await tx.query(
      `INSERT INTO vehicles (user_id, categoria, marca, modelo, capacidad)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET categoria = EXCLUDED.categoria,
             marca     = EXCLUDED.marca,
             modelo    = EXCLUDED.modelo,
             capacidad = EXCLUDED.capacidad`,
      [userId, vehicle.categoria, vehicle.marca ?? null, vehicle.modelo ?? null, vehicle.capacidad],
    );
    return true;
  }

  /** Borra el vehículo y deja al usuario como pasajero. Devuelve false si el usuario no existe. */
  async removeVehicle(tx: Executor, userId: string): Promise<boolean> {
    const { rowCount } = await tx.query(
      `UPDATE users SET tipo_usuario = 'pasajero' WHERE id = $1`,
      [userId],
    );
    if (!rowCount) return false;
    await tx.query(`DELETE FROM vehicles WHERE user_id = $1`, [userId]);
    return true;
  }

  async findById(id: string, tx?: Executor): Promise<User | null> {
    const executor = tx ?? this.db.pool;
    const { rows } = await executor.query<UserRow>(`${SELECT_USER} WHERE u.id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  /** Paginación por cursor (creado_en, id): usa idx_users_creado, sin OFFSET. */
  async list(filter: ListFilter): Promise<{ items: User[]; last?: { ts: string; id: string } }> {
    const where: string[] = [];
    const params: unknown[] = [];
    const param = (value: unknown) => `$${params.push(value)}`;

    if (filter.tipo) where.push(`u.tipo_usuario = ${param(filter.tipo)}`);
    if (filter.verificado !== undefined) where.push(`u.verificado = ${param(filter.verificado)}`);
    if (filter.after) {
      where.push(`(u.creado_en, u.id) > (${param(filter.after.ts)}::timestamptz, ${param(filter.after.id)}::uuid)`);
    }

    const rows = await this.db.query<UserRow>(
      `${SELECT_USER}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY u.creado_en, u.id
       LIMIT ${param(filter.limit + 1)}`,
      params,
    );

    const page = rows.slice(0, filter.limit);
    const tail = page[page.length - 1];
    return {
      items: page.map(toUser),
      last: rows.length > filter.limit && tail ? { ts: tail.cursor_ts, id: tail.id } : undefined,
    };
  }

  async update(id: string, fields: { nombre?: string; fotoUrl?: string | null }): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const param = (value: unknown) => `$${params.push(value)}`;

    if (fields.nombre !== undefined) sets.push(`nombre = ${param(fields.nombre)}`);
    if (fields.fotoUrl !== undefined) sets.push(`foto_url = ${param(fields.fotoUrl)}`);

    const { rowCount } = await this.db.pool.query(
      sets.length
        ? `UPDATE users SET ${sets.join(', ')} WHERE id = ${param(id)}`
        : `SELECT 1 FROM users WHERE id = ${param(id)}`,
      params,
    );
    return Boolean(rowCount);
  }

  /** ON DELETE CASCADE borra vehículo, viajes, pasajes, pagos e historial. */
  async delete(id: string): Promise<boolean> {
    const { rowCount } = await this.db.pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    return Boolean(rowCount);
  }
}
