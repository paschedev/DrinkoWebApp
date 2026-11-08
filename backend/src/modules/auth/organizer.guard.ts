import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest, SessionGuard } from './session.guard';

// Rutas del Panel del Organizador: además de la sesión, exige el rol ORGANIZER.
@Injectable()
export class OrganizerGuard extends SessionGuard {
  async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user.role !== UserRole.ORGANIZER || !user.organizationId) {
      throw new ForbiddenException('Solo el organizador puede hacer esto');
    }
    return true;
  }
}
