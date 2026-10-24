import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseError } from 'pg';
import { EventsService } from '../events/events.service';
import { LocationService } from '../location/location.service';
import { CreateUserDto, VehicleDto } from './dto/create-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { UpdateUserDto } from './dto/update-user.dto';
import { hashPassword } from './password';
import { UsersRepository } from './users.repository';
import { User } from './users.types';

/** Traduce errores de PostgreSQL a HTTP; la BD es la última barrera (constitución, principio 10). */
const translate = (err: unknown): never => {
  if (err instanceof DatabaseError) {
    if (err.code === '23505') throw new ConflictException('El correo ya está registrado');
    if (err.code === '23514') {
      if (err.constraint === 'chk_pref_solo_mujeres') {
        throw new BadRequestException("prefSexoViaje 'solo_F' sólo aplica cuando sexo = 'F'");
      }
      if (err.constraint === 'chk_correo_anahuac') throw new BadRequestException('correo debe ser @anahuac.mx');
      throw new BadRequestException(`Restricción violada: ${err.constraint}`);
    }
  }
  throw err;
};

const encodeCursor = (c: { ts: string; id: string }) => Buffer.from(`${c.ts}|${c.id}`).toString('base64url');

const decodeCursor = (cursor: string): { ts: string; id: string } => {
  const [ts, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!ts || !id || Number.isNaN(Date.parse(ts))) throw new BadRequestException('Cursor inválido');
  return { ts, id };
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repo: UsersRepository,
    private readonly events: EventsService,
    private readonly location: LocationService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const prefSexoViaje = dto.prefSexoViaje ?? 'cualquiera';
    if (prefSexoViaje === 'solo_F' && dto.sexo !== 'F') {
      throw new BadRequestException("prefSexoViaje 'solo_F' sólo aplica cuando sexo = 'F'");
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.repo
      .transaction(async (tx) => {
        const id = await this.repo.insert(tx, {
          nombre: dto.nombre,
          correo: dto.correo,
          passwordHash,
          sexo: dto.sexo,
          tipoUsuario: dto.vehiculo ? 'conductor' : 'pasajero',
          prefSexoViaje,
        });
        if (dto.vehiculo) await this.repo.upsertVehicle(tx, id, dto.vehiculo);
        return (await this.repo.findById(id, tx))!;
      })
      .catch(translate);

    await this.emit('user.registered', { userId: user.id, tipoUsuario: user.tipoUsuario, vehiculo: user.vehiculo });
    return user;
  }

  async get(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  async list(query: ListUsersQuery): Promise<{ items: User[]; nextCursor: string | null }> {
    const { items, last } = await this.repo.list({
      tipo: query.tipo,
      verificado: query.verificado,
      limit: query.limit,
      after: query.after ? decodeCursor(query.after) : undefined,
    });
    return { items, nextCursor: last ? encodeCursor(last) : null };
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const fields = { nombre: dto.nombre, fotoUrl: dto.fotoUrl };
    if (!(await this.repo.update(id, fields))) throw new NotFoundException(`Usuario ${id} no encontrado`);

    const changed = Object.keys(fields).filter((k) => fields[k as keyof typeof fields] !== undefined);
    if (changed.length) await this.emit('user.updated', { userId: id, changed });
    return this.get(id);
  }

  async setVehicle(id: string, dto: VehicleDto): Promise<User> {
    const user = await this.repo.transaction(async (tx) => {
      if (!(await this.repo.upsertVehicle(tx, id, dto))) return null;
      return this.repo.findById(id, tx);
    });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);

    await this.emit('vehicle.updated', { userId: id, vehiculo: user.vehiculo });
    return user;
  }

  async removeVehicle(id: string): Promise<void> {
    const found = await this.repo.transaction((tx) => this.repo.removeVehicle(tx, id));
    if (!found) throw new NotFoundException(`Usuario ${id} no encontrado`);
    await this.emit('vehicle.removed', { userId: id });
  }

  async delete(id: string): Promise<void> {
    if (!(await this.repo.delete(id))) throw new NotFoundException(`Usuario ${id} no encontrado`);
    // La ubicación efímera también se olvida de inmediato (privacidad por diseño).
    await this.location.clear(id);
    await this.emit('user.deleted', { userId: id });
  }

  /**
   * Publica tras el COMMIT. Si falla, el cambio ya está guardado: se registra el error
   * en vez de devolver 500 (riesgo aceptado en spec 005: eventos best-effort sin outbox).
   */
  private async emit(type: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.events.publish(type, payload);
    } catch (err) {
      this.logger.error(`No se pudo publicar ${type} para ${String(payload.userId)}: ${(err as Error).message}`);
    }
  }
}
