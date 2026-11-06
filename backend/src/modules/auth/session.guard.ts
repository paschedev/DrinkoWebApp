import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from './auth-user';
import { AuthService, SESSION_COOKIE } from './auth.service';

export type AuthenticatedRequest = Request & { user: AuthUser };

// Deja pasar solo a usuarios con una sesión vigente.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user = typeof token === 'string' ? await this.auth.findUserByToken(token) : null;
    if (!user) throw new UnauthorizedException('Iniciá sesión para continuar');
    req.user = user;
    return true;
  }
}
