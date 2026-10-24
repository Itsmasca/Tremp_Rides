import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './auth.types';
import { AuthenticatedRequest } from './jwt-auth.guard';

/** `@CurrentUser() user: JwtPayload` en cualquier handler protegido con JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
