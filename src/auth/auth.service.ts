import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { verifyPassword } from '../users/password';
import { User } from '../users/users.types';
import { UsersService } from '../users/users.service';
import { AuthResponse, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';

/**
 * Login y sesión (spec 009). El alta de usuarios es la de spec 005 (`UsersService.create`):
 * aquí sólo se le añade el token para que la app entre directo a /home.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  /** Mismo body y validaciones que `POST /users`; responde `{ token, user }`. */
  async register(dto: CreateUserDto): Promise<AuthResponse> {
    const user = await this.users.create(dto);
    return this.respond(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const row = await this.db.queryOne<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE correo = $1',
      [dto.correo],
    );

    // Mismo mensaje si el correo no existe o la contraseña falla: no revelar qué correos hay.
    const ok = row ? await verifyPassword(dto.password, row.password_hash) : false;
    if (!row || !ok) throw new UnauthorizedException('Correo o contraseña incorrectos');

    return this.respond(await this.users.get(row.id));
  }

  /** Para restaurar la sesión al abrir la app. */
  me(userId: string): Promise<User> {
    return this.users.get(userId).catch(() => {
      throw new UnauthorizedException('Sesión inválida');
    });
  }

  private async respond(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, tipoUsuario: user.tipoUsuario };
    return { token: await this.jwt.signAsync(payload), user };
  }
}
