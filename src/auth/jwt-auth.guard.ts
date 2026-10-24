import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';
import { JwtPayload } from './auth.types';

export type AuthenticatedRequest = FastifyRequest & { user: JwtPayload };

/** Protege rutas con `Authorization: Bearer <token>`. Deja el payload en `request.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token');

    try {
      request.user = await this.jwt.verifyAsync<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Sesión expirada o inválida');
    }
  }
}
