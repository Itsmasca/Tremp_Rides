import { TipoUsuario, User } from '../users/users.types';

/** Respuesta de /auth/register y /auth/login. `user` es el mismo objeto que devuelve /users/:id. */
export type AuthResponse = { token: string; user: User };

/** Contenido del JWT. */
export type JwtPayload = { sub: string; tipoUsuario: TipoUsuario };
